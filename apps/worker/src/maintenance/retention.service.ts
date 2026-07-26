import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, PrismaService, RedisService } from '../../../../packages/shared/src';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULTS = {
  auditLogDays: 365,
  alertDeliveryDays: 90,
  incidentEventDays: 180,
};

export type RetentionResult = {
  refreshTokens: number;
  passwordResets: number;
  auditLogs: number;
  alertDeliveries: number;
  incidentEvents: number;
};

/**
 * Deletes rows that have outlived their retention window.
 *
 * MongoDB expires raw and parsed logs through a TTL index, but Postgres has no equivalent,
 * so these tables would otherwise grow forever. Expired refresh tokens are pure dead weight;
 * the rest are bounded by an explicit policy rather than by "keep everything".
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit() {
    const interval = this.config.get<number>('RETENTION_INTERVAL_MS') ?? DEFAULT_INTERVAL_MS;

    // Delay the first pass so a restart loop cannot turn into a delete storm.
    this.timer = setInterval(() => void this.runIfDue(interval), interval);
    this.timer.unref?.();
  }

  /**
   * Claims the run in Redis first, so several worker replicas do not all sweep the same
   * tables at the same time.
   */
  async runIfDue(intervalMs: number) {
    try {
      if (!(await this.redis.claim('maintenance:retention', Math.floor(intervalMs * 0.9)))) return;

      const result = await this.run();
      const total = Object.values(result).reduce((sum, count) => sum + count, 0);

      if (total > 0) this.logger.log({ ...result }, 'retention sweep removed expired rows');
    } catch (error) {
      this.logger.warn({ err: String(error) }, 'retention sweep failed');
    }
  }

  async run(now = new Date()): Promise<RetentionResult> {
    const [refreshTokens, passwordResets, auditLogs, alertDeliveries, incidentEvents] = await Promise.all([
      this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: this.cutoff(now, 'auditLogDays') } },
      }),
      this.prisma.alertDelivery.deleteMany({
        where: { createdAt: { lt: this.cutoff(now, 'alertDeliveryDays') } },
      }),
      this.prisma.incidentEvent.deleteMany({
        where: { createdAt: { lt: this.cutoff(now, 'incidentEventDays') } },
      }),
    ]);

    return {
      refreshTokens: refreshTokens.count,
      passwordResets: passwordResets.count,
      auditLogs: auditLogs.count,
      alertDeliveries: alertDeliveries.count,
      incidentEvents: incidentEvents.count,
    };
  }

  private cutoff(now: Date, setting: keyof typeof DEFAULTS) {
    const envKey = {
      auditLogDays: 'AUDIT_LOG_RETENTION_DAYS',
      alertDeliveryDays: 'ALERT_DELIVERY_RETENTION_DAYS',
      incidentEventDays: 'INCIDENT_EVENT_RETENTION_DAYS',
    }[setting];
    const configured = Number(this.config.get(envKey));
    const days = Number.isFinite(configured) && configured > 0 ? configured : DEFAULTS[setting];

    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
