import { Injectable, NotFoundException } from '@nestjs/common';
import { LogLevel, LogSourceType, PrismaService, RedisService } from '../../../../../packages/shared/src';
import { memberProjectFilter, ProjectAccessService } from '../../common/services/project-access.service';
import { ServiceStatsBuffer } from './service-stats.buffer';

type RegisterLogInput = {
  name: string;
  environment: string;
  sourceType: LogSourceType;
  level: LogLevel;
  metadata?: unknown;
  timestamp?: Date;
};

const SERVICE_ID_CACHE_TTL_MS = 300_000;
/** How often the slow-moving fields (sourceTypes, metadata) are refreshed per service. */
const DETAILS_REFRESH_MS = 60_000;

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly stats: ServiceStatsBuffer,
    private readonly access: ProjectAccessService,
  ) {}

  async findByProject(userId: string, projectId: string) {
    await this.access.assert(userId, projectId);

    return this.prisma.service.findMany({
      where: { projectId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async findOne(userId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        project: memberProjectFilter(userId),
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  /**
   * Resolves (and lazily registers) the service a log belongs to.
   *
   * Only the first log for a service touches Postgres; after that the id comes from Redis,
   * counters are batched by {@link ServiceStatsBuffer}, and the rarely changing fields are
   * refreshed at most once a minute. Ingestion used to do a read plus a write here for
   * every single log line.
   */
  async recordLog(projectId: string, input: RegisterLogInput): Promise<{ id: string }> {
    const cacheKey = `service:${projectId}:${input.environment}:${input.name}`;
    const cached = await this.redis.getJson<string>(cacheKey);
    const serviceId = cached ?? (await this.register(projectId, input));

    if (!cached) await this.redis.setJson(cacheKey, serviceId, SERVICE_ID_CACHE_TTL_MS);

    this.stats.record(serviceId, {
      isError: isErrorLevel(input.level),
      timestamp: input.timestamp ?? new Date(),
    });

    if (cached) void this.refreshDetails(serviceId, input);

    return { id: serviceId };
  }

  private async register(projectId: string, input: RegisterLogInput) {
    const service = await this.prisma.service.upsert({
      where: {
        projectId_name_environment: {
          projectId,
          name: input.name,
          environment: input.environment,
        },
      },
      create: {
        projectId,
        name: input.name,
        environment: input.environment,
        sourceTypes: [input.sourceType],
        metadata: input.metadata === undefined ? undefined : (input.metadata as object),
        lastSeenAt: input.timestamp ?? new Date(),
      },
      update: {},
      select: { id: true },
    });

    return service.id;
  }

  /**
   * Adds a newly seen source type and refreshes metadata. Throttled per service because a
   * service's shape changes on the order of once per deploy, not once per log line.
   */
  private async refreshDetails(serviceId: string, input: RegisterLogInput) {
    try {
      if (!(await this.redis.claim(`service:details:${serviceId}`, DETAILS_REFRESH_MS))) return;

      const service = await this.prisma.service.findUnique({
        where: { id: serviceId },
        select: { sourceTypes: true },
      });
      if (!service) return;

      const sourceTypes = service.sourceTypes.includes(input.sourceType)
        ? undefined
        : [...service.sourceTypes, input.sourceType];

      if (!sourceTypes && input.metadata === undefined) return;

      await this.prisma.service.update({
        where: { id: serviceId },
        data: {
          ...(sourceTypes ? { sourceTypes } : {}),
          ...(input.metadata === undefined ? {} : { metadata: input.metadata as object }),
        },
      });
    } catch {
      // Best effort: never fail ingestion because service metadata could not be refreshed.
    }
  }
}

export function isErrorLevel(level: LogLevel) {
  return level === 'error' || level === 'fatal';
}
