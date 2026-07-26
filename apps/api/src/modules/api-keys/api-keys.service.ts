import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyType, ProjectRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService, RedisService } from '../../../../../packages/shared/src';
import { AuditActor, AuditService } from '../../common/services/audit.service';
import { HashingService } from '../../common/services/hashing.service';
import { memberProjectFilter, ProjectAccessService } from '../../common/services/project-access.service';
import { ApiKeyContext } from '../../common/types/auth.types';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

const DEFAULT_CACHE_TTL_MS = 60_000;
/** Unknown keys are cached briefly too, so a brute force attempt cannot hammer Postgres. */
const NEGATIVE_CACHE_TTL_MS = 10_000;
const LAST_USED_THROTTLE_MS = 60_000;

type CachedApiKey = ApiKeyContext | { invalid: true };

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashingService: HashingService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async create(actor: AuditActor, projectId: string, dto: CreateApiKeyDto) {
    await this.access.assert(actor.id!, projectId, ProjectRole.ADMIN);

    const rawKey = this.generateRawKey(dto.type);
    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        type: dto.type,
        prefix: rawKey.slice(0, 18),
        keyHash: this.hashingService.hashApiKey(rawKey),
        projectId,
      },
      select: this.safeSelect(),
    });

    await this.audit.record({
      actor,
      action: 'api_key.created',
      targetType: 'api_key',
      targetId: apiKey.id,
      projectId,
      // The prefix identifies the key without exposing it.
      metadata: { name: apiKey.name, type: apiKey.type, prefix: apiKey.prefix },
    });

    return {
      ...apiKey,
      key: rawKey,
    };
  }

  async findAll(userId: string, projectId: string) {
    await this.access.assert(userId, projectId, ProjectRole.ADMIN);

    return this.prisma.apiKey.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: this.safeSelect(),
    });
  }

  async revoke(actor: AuditActor, apiKeyId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: apiKeyId,
        project: memberProjectFilter(actor.id!),
      },
      select: { id: true, keyHash: true, name: true, prefix: true, projectId: true },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });
    // Drop the cached grant immediately; otherwise a revoked key keeps working for the TTL.
    await this.redis.del(this.cacheKey(apiKey.keyHash));
    await this.audit.record({
      actor,
      action: 'api_key.revoked',
      targetType: 'api_key',
      targetId: apiKeyId,
      projectId: apiKey.projectId,
      metadata: { name: apiKey.name, prefix: apiKey.prefix },
    });

    return { revoked: true };
  }

  /**
   * Resolves a raw API key to its project on the hot ingestion path.
   *
   * The lookup is cached in Redis and `lastUsedAt` is written at most once per minute per
   * key, so a burst of log writes no longer produces one Postgres read plus one Postgres
   * write per request.
   */
  async validateRawKey(rawKey?: string): Promise<ApiKeyContext> {
    if (!rawKey) {
      throw new UnauthorizedException('API key is required');
    }

    const keyHash = this.hashingService.hashApiKey(rawKey);
    const cached = await this.redis.getJson<CachedApiKey>(this.cacheKey(keyHash));

    if (cached && 'invalid' in cached) {
      throw new UnauthorizedException('Invalid API key');
    }

    const apiKey = cached ?? (await this.lookup(keyHash));

    if (!apiKey) {
      await this.redis.setJson(this.cacheKey(keyHash), { invalid: true }, NEGATIVE_CACHE_TTL_MS);
      throw new UnauthorizedException('Invalid API key');
    }

    if (!cached) {
      await this.redis.setJson(this.cacheKey(keyHash), apiKey, this.cacheTtlMs);
    }

    void this.touchLastUsed(apiKey.id);
    return apiKey;
  }

  private async lookup(keyHash: string): Promise<ApiKeyContext | undefined> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { keyHash, revokedAt: null },
      select: { id: true, type: true, projectId: true },
    });

    return apiKey ?? undefined;
  }

  private async touchLastUsed(apiKeyId: string) {
    try {
      if (!(await this.redis.claim(`apikey:lastused:${apiKeyId}`, LAST_USED_THROTTLE_MS))) return;

      await this.prisma.apiKey.update({
        where: { id: apiKeyId },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      // Best effort telemetry: never fail ingestion because the timestamp could not be written.
    }
  }

  private get cacheTtlMs() {
    return this.config.get<number>('API_KEY_CACHE_TTL_MS') ?? DEFAULT_CACHE_TTL_MS;
  }

  private cacheKey(keyHash: string) {
    return `apikey:${keyHash}`;
  }

  private generateRawKey(type: ApiKeyType) {
    const label = type === ApiKeyType.SERVER ? 'server' : 'client';
    return `lm_${label}_${randomBytes(32).toString('base64url')}`;
  }

  private safeSelect() {
    return {
      id: true,
      name: true,
      type: true,
      prefix: true,
      projectId: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    };
  }
}
