import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  LogLevel,
  LogSourceType,
  PrismaService,
  MetricsService,
  RawLog,
  redactDeep,
  redactText,
} from '../../../../../packages/shared/src';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { pagination } from '../../common/utils/pagination';
import { ApiKeyContext } from '../../common/types/auth.types';
import { ServicesService } from '../services/services.service';
import { FindLogsQueryDto } from './dto/find-logs-query.dto';
import { buildLogFilter, logSort } from './log-filter';
import { FrontendLogDto } from './dto/frontend-log.dto';
import { LogIngestionDto } from './dto/log-ingestion.dto';
import { LogQueueProducer } from './log-queue.producer';

type StoredLogInput = {
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
};

function fromIngestionDto(dto: LogIngestionDto): StoredLogInput {
  return {
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
  };
}

@Injectable()
export class LogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicesService: ServicesService,
    private readonly access: ProjectAccessService,
    private readonly logQueueProducer: LogQueueProducer,
    private readonly metrics: MetricsService,
    @InjectModel(RawLog.name) private readonly rawLogModel: Model<RawLog>,
  ) {}

  async ingest(apiKey: ApiKeyContext, dto: LogIngestionDto) {
    return this.store(apiKey, fromIngestionDto(dto));
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

  async findAll(userId: string, query: FindLogsQueryDto) {
    const { page, limit, skip } = pagination(query.page, query.limit);
    const filter = buildLogFilter(await this.access.scopeProjectIds(userId, query.projectId), query);
    const [items, total] = await Promise.all([
      this.rawLogModel.find(filter).sort(logSort(query)).skip(skip).limit(limit).lean(),
      this.rawLogModel.countDocuments(filter),
    ]);

    return {
      items: items.map(this.toResponse),
      page,
      limit,
      total,
    };
  }

  async findByService(userId: string, serviceId: string, query: FindLogsQueryDto) {
    const service = await this.servicesService.findOne(userId, serviceId);
    return this.findAll(userId, {
      ...query,
      projectId: service.projectId,
      serviceId,
    });
  }

  async findOne(userId: string, logId: string) {
    if (!Types.ObjectId.isValid(logId)) {
      throw new BadRequestException('Invalid log id');
    }

    const log = await this.rawLogModel.findById(logId).lean();

    if (!log) {
      throw new NotFoundException('Log not found');
    }

    await this.access.assert(userId, log.projectId);
    return this.toResponse(log);
  }

  /**
   * Stores a batch of logs with one Mongo `insertMany` and one queue `addBulk`.
   *
   * A batch of N logs costs one bulk insert plus one bulk enqueue instead of N of each,
   * which is what makes the Docker agent's batching worth doing.
   */
  async ingestBulk(apiKey: ApiKeyContext, dtos: LogIngestionDto[]) {
    if (!dtos.length) return { success: true, accepted: 0, queued: 0, logIds: [] as string[] };

    const prepared = await Promise.all(
      dtos.map(async (dto) => {
        const input = fromIngestionDto(dto);
        const document = await this.buildDocument(apiKey, input);
        return { input, document };
      }),
    );
    const inserted = await this.rawLogModel.insertMany(
      prepared.map((entry) => entry.document),
      { ordered: false },
    );
    const logIds = inserted.map((log) => String(log._id));
    const queued = await this.logQueueProducer.enqueueMany(
      prepared.map((entry, index) => ({
        id: logIds[index],
        projectId: apiKey.projectId,
        serviceId: String(entry.document.serviceId),
        sourceType: entry.input.sourceType,
        level: entry.input.level,
      })),
    );

    for (const entry of prepared) this.countIngested(entry.input);
    this.metrics.logsQueued.inc(queued);

    return { success: true, accepted: logIds.length, queued, logIds };
  }

  private async store(apiKey: ApiKeyContext, input: StoredLogInput) {
    const document = await this.buildDocument(apiKey, input);
    const log = await this.rawLogModel.create(document);
    const logId = log._id.toString();
    const queued = await this.logQueueProducer.enqueueIfRelevant({
      id: logId,
      projectId: apiKey.projectId,
      serviceId: String(document.serviceId),
      sourceType: input.sourceType,
      level: input.level,
    });

    this.countIngested(input);
    if (queued) this.metrics.logsQueued.inc();

    return {
      success: true,
      logId,
      queued,
    };
  }

  private countIngested(input: StoredLogInput) {
    this.metrics.logsIngested.inc({ source_type: input.sourceType, level: input.level });
  }

  /** Redacts the payload and resolves the owning service. Shared by single and bulk ingest. */
  private async buildDocument(apiKey: ApiKeyContext, input: StoredLogInput) {
    const metadata = redactDeep(input.metadata) as Record<string, unknown> | undefined;
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    const service = await this.servicesService.recordLog(apiKey.projectId, {
      name: input.serviceName,
      environment: input.environment,
      sourceType: input.sourceType,
      level: input.level,
      metadata,
      timestamp,
    });

    return {
      projectId: apiKey.projectId,
      serviceId: service.id,
      apiKeyId: apiKey.id,
      sourceType: input.sourceType,
      serviceName: input.serviceName,
      environment: input.environment,
      level: input.level,
      message: redactText(input.message),
      timestamp,
      requestId: input.requestId,
      api: redactDeep(input.api),
      frontend: redactDeep(input.frontend),
      metadata,
      stackTrace: input.stackTrace ? redactText(input.stackTrace) : undefined,
    };
  }

  private toResponse(log: Record<string, unknown>) {
    return {
      ...log,
      id: String(log._id),
    };
  }
}
