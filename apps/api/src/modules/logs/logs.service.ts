import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LogLevel, LogSourceType, PrismaService, RawLog } from '../../../../../packages/shared/src';
import { maskSensitiveData } from '../../common/utils/mask-sensitive-data';
import { pagination } from '../../common/utils/pagination';
import { ApiKeyContext } from '../../common/types/auth.types';
import { ServicesService } from '../services/services.service';
import { FindLogsQueryDto } from './dto/find-logs-query.dto';
import { FrontendLogDto } from './dto/frontend-log.dto';
import { LogIngestionDto } from './dto/log-ingestion.dto';
import { LogQueueProducer } from './log-queue.producer';

type LogQueryFilter = Record<string, unknown>;

@Injectable()
export class LogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicesService: ServicesService,
    private readonly logQueueProducer: LogQueueProducer,
    @InjectModel(RawLog.name) private readonly rawLogModel: Model<RawLog>,
  ) {}

  async ingest(apiKey: ApiKeyContext, dto: LogIngestionDto) {
    return this.store(apiKey, {
      sourceType: dto.sourceType as LogSourceType,
      serviceName: dto.serviceName,
      environment: dto.environment,
      level: dto.level as LogLevel,
      message: dto.message,
      timestamp: dto.timestamp,
      requestId: dto.requestId,
      api: dto.api,
      metadata: dto.metadata,
      stackTrace: dto.stackTrace,
    });
  }

  async ingestFrontend(apiKey: ApiKeyContext, dto: FrontendLogDto) {
    return this.store(apiKey, {
      sourceType: 'frontend',
      serviceName: dto.serviceName,
      environment: dto.environment,
      level: dto.level as LogLevel,
      message: dto.message,
      timestamp: dto.timestamp,
      requestId: dto.requestId,
      api: dto.api,
      frontend: dto.frontend,
      metadata: dto.metadata,
      stackTrace: dto.stackTrace,
    });
  }

  async findAll(ownerId: string, query: FindLogsQueryDto) {
    const { page, limit, skip } = pagination(query.page, query.limit);
    const filter = await this.buildFilter(ownerId, query);
    const [items, total] = await Promise.all([
      this.rawLogModel.find(filter).sort({ timestamp: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.rawLogModel.countDocuments(filter),
    ]);

    return {
      items: items.map(this.toResponse),
      page,
      limit,
      total,
    };
  }

  async findByService(ownerId: string, serviceId: string, query: FindLogsQueryDto) {
    const service = await this.servicesService.findOne(ownerId, serviceId);
    return this.findAll(ownerId, {
      ...query,
      projectId: service.projectId,
      serviceId,
    });
  }

  async findOne(ownerId: string, logId: string) {
    if (!Types.ObjectId.isValid(logId)) {
      throw new BadRequestException('Invalid log id');
    }

    const log = await this.rawLogModel.findById(logId).lean();

    if (!log) {
      throw new NotFoundException('Log not found');
    }

    await this.ensureProjectOwner(ownerId, log.projectId);
    return this.toResponse(log);
  }

  private async store(
    apiKey: ApiKeyContext,
    input: {
      sourceType: LogSourceType;
      serviceName: string;
      environment: string;
      level: LogLevel;
      message: string;
      timestamp?: string;
      requestId?: string;
      api?: Record<string, unknown>;
      frontend?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      stackTrace?: string;
    },
  ) {
    const metadata = maskSensitiveData(input.metadata) as Record<string, unknown> | undefined;
    const service = await this.servicesService.recordLog(apiKey.projectId, {
      name: input.serviceName,
      environment: input.environment,
      sourceType: input.sourceType,
      level: input.level,
      metadata,
    });
    const log = await this.rawLogModel.create({
      projectId: apiKey.projectId,
      serviceId: service.id,
      apiKeyId: apiKey.id,
      sourceType: input.sourceType,
      serviceName: input.serviceName,
      environment: input.environment,
      level: input.level,
      message: input.message,
      timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
      requestId: input.requestId,
      api: maskSensitiveData(input.api),
      frontend: maskSensitiveData(input.frontend),
      metadata,
      stackTrace: input.stackTrace,
    });
    const logId = log._id.toString();
    const queued = await this.logQueueProducer.enqueueIfRelevant({
      id: logId,
      projectId: apiKey.projectId,
      serviceId: service.id,
      sourceType: input.sourceType,
      level: input.level,
    });

    return {
      success: true,
      logId,
      queued,
    };
  }

  private async buildFilter(ownerId: string, query: FindLogsQueryDto): Promise<LogQueryFilter> {
    const projectIds = await this.projectIdsFor(ownerId, query.projectId);
    const filter: LogQueryFilter = {
      projectId: projectIds.length === 1 ? projectIds[0] : { $in: projectIds },
    };

    if (!projectIds.length) {
      return { projectId: '__none__' };
    }

    if (query.serviceId) filter.serviceId = query.serviceId;
    if (query.sourceType) filter.sourceType = query.sourceType;
    if (query.level) filter.level = query.level;
    if (query.environment) filter.environment = query.environment;
    if (query.statusCode) filter['api.statusCode'] = query.statusCode;
    if (query.path) filter['api.path'] = { $regex: this.escapeRegex(query.path), $options: 'i' };

    if (query.from || query.to) {
      filter.timestamp = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    if (query.keyword) {
      const keyword = { $regex: this.escapeRegex(query.keyword), $options: 'i' };
      filter.$or = [
        { message: keyword },
        { stackTrace: keyword },
        { 'api.path': keyword },
        { 'frontend.pageUrl': keyword },
      ];
    }

    return filter;
  }

  private async projectIdsFor(ownerId: string, projectId?: string) {
    if (projectId) {
      await this.ensureProjectOwner(ownerId, projectId);
      return [projectId];
    }

    const projects = await this.prisma.project.findMany({
      where: { ownerId },
      select: { id: true },
    });

    return projects.map((project) => project.id);
  }

  private async ensureProjectOwner(ownerId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private toResponse(log: Record<string, unknown>) {
    return {
      ...log,
      id: String(log._id),
    };
  }
}
