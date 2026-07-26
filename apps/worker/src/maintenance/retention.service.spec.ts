import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { PinoLogger, PrismaService, RedisService } from '../../../../packages/shared/src';
import { RetentionService } from './retention.service';

function harness(options: { settings?: Record<string, unknown>; claim?: boolean } = {}) {
  const deleted: Record<string, Date> = {};
  const table = (name: string) => ({
    deleteMany: vi.fn(async ({ where }: { where: Record<string, { lt: Date }> }) => {
      deleted[name] = Object.values(where)[0].lt;
      return { count: 1 };
    }),
  });
  const prisma = {
    refreshToken: table('refreshToken'),
    passwordResetToken: table('passwordResetToken'),
    auditLog: table('auditLog'),
    alertDelivery: table('alertDelivery'),
    incidentEvent: table('incidentEvent'),
  } as unknown as PrismaService;
  const redis = { claim: vi.fn().mockResolvedValue(options.claim ?? true) } as unknown as RedisService;
  const config = { get: (key: string) => options.settings?.[key] } as unknown as ConfigService;
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;

  return { service: new RetentionService(prisma, redis, config, logger), deleted, prisma, redis, logger };
}

const now = new Date('2026-07-26T12:00:00.000Z');
const daysBefore = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe('RetentionService.run', () => {
  it('sweeps every unbounded table', async () => {
    const { service } = harness();

    await expect(service.run(now)).resolves.toEqual({
      refreshTokens: 1,
      passwordResets: 1,
      auditLogs: 1,
      alertDeliveries: 1,
      incidentEvents: 1,
    });
  });

  it('deletes tokens that already expired, not by age', async () => {
    const { service, deleted } = harness();

    await service.run(now);

    expect(deleted.refreshToken).toEqual(now);
    expect(deleted.passwordResetToken).toEqual(now);
  });

  it('applies the default retention windows', async () => {
    const { service, deleted } = harness();

    await service.run(now);

    expect(deleted.auditLog).toEqual(daysBefore(365));
    expect(deleted.alertDelivery).toEqual(daysBefore(90));
    expect(deleted.incidentEvent).toEqual(daysBefore(180));
  });

  it('honours configured windows', async () => {
    const { service, deleted } = harness({
      settings: {
        AUDIT_LOG_RETENTION_DAYS: 30,
        ALERT_DELIVERY_RETENTION_DAYS: 7,
        INCIDENT_EVENT_RETENTION_DAYS: 14,
      },
    });

    await service.run(now);

    expect(deleted.auditLog).toEqual(daysBefore(30));
    expect(deleted.alertDelivery).toEqual(daysBefore(7));
    expect(deleted.incidentEvent).toEqual(daysBefore(14));
  });

  it.each([0, -5, 'lots', undefined])('falls back on the invalid window %j', async (value) => {
    const { service, deleted } = harness({ settings: { AUDIT_LOG_RETENTION_DAYS: value } });

    await service.run(now);

    expect(deleted.auditLog).toEqual(daysBefore(365));
  });
});

describe('RetentionService.runIfDue', () => {
  it('runs when it wins the claim', async () => {
    const { service, prisma } = harness({ claim: true });

    await service.runIfDue(3_600_000);

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalled();
  });

  it('skips when another replica already claimed the sweep', async () => {
    const { service, prisma } = harness({ claim: false });

    await service.runIfDue(3_600_000);

    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
  });

  it('claims for slightly less than the interval so the next tick is not skipped', async () => {
    const { service, redis } = harness();

    await service.runIfDue(3_600_000);

    expect(redis.claim).toHaveBeenCalledWith('maintenance:retention', 3_240_000);
  });

  it('logs instead of throwing when the database is unavailable', async () => {
    const { service, redis, logger } = harness();
    (redis.claim as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('redis down'));

    await expect(service.runIfDue(3_600_000)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
