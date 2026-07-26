import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertDeliveryStatus, AlertTrigger, Incident, Service } from '@prisma/client';
import {
  AlertMessageInput,
  buildAlertRequest,
  MetricsService,
  openMaybeSealed,
  PinoLogger,
  PrismaService,
  RedisService,
  resolveEncryptionKey,
  ruleMatches,
} from '../../../../packages/shared/src';

const DELIVERY_TIMEOUT_MS = 5_000;

@Injectable()
export class AlertDispatcherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /**
   * Fans one incident event out to every matching rule.
   *
   * Delivery never blocks or fails log processing: each channel is attempted independently
   * and the outcome is recorded in `AlertDelivery` whether it worked or not.
   */
  async dispatch(input: { incident: Incident; service: Service; trigger: AlertTrigger }) {
    const rules = await this.prisma.alertRule.findMany({
      where: { projectId: input.incident.projectId, enabled: true, channel: { enabled: true } },
      include: { channel: true },
    });

    const matching = rules.filter((rule) =>
      ruleMatches(rule, {
        trigger: input.trigger,
        severity: input.incident.severity,
        serviceId: input.incident.serviceId,
        environment: input.service.environment,
      }),
    );
    if (!matching.length) return { matched: 0, sent: 0 };

    const message = this.messageFor(input);
    const results = await Promise.all(
      matching.map((rule) => this.deliver(rule, input.incident.id, input.trigger, message)),
    );

    return { matched: matching.length, sent: results.filter(Boolean).length };
  }

  private async deliver(
    rule: {
      id: string;
      channelId: string;
      throttleMinutes: number;
      channel: { type: string; config: unknown };
    },
    incidentId: string,
    trigger: AlertTrigger,
    message: AlertMessageInput,
  ) {
    // One claim per rule+incident: a loud incident produces one alert per throttle window,
    // not one per error log.
    const throttleMs = Math.max(0, rule.throttleMinutes) * 60_000;
    const claimed =
      throttleMs === 0 || (await this.redis.claim(`alert:${rule.id}:${incidentId}`, throttleMs));

    if (!claimed) {
      await this.record(rule, incidentId, trigger, AlertDeliveryStatus.THROTTLED);
      return false;
    }

    try {
      const request = buildAlertRequest(
        rule.channel.type as Parameters<typeof buildAlertRequest>[0],
        openMaybeSealed<Record<string, unknown>>(rule.channel.config ?? {}, this.encryptionKey),
        message,
      );
      const response = await this.fetchImpl(request.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...request.headers },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });

      if (!response.ok) throw new Error(`Channel responded ${response.status}`);

      await this.record(rule, incidentId, trigger, AlertDeliveryStatus.SENT);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Alert delivery failed';

      this.logger.warn({ ruleId: rule.id, incidentId, err: reason }, 'alert delivery failed');
      await this.record(rule, incidentId, trigger, AlertDeliveryStatus.FAILED, reason);
      return false;
    }
  }

  private async record(
    rule: { id: string; channelId: string; channel?: { type: string } },
    incidentId: string,
    trigger: AlertTrigger,
    status: AlertDeliveryStatus,
    error?: string,
  ) {
    const channelType = rule.channel?.type ?? 'unknown';
    this.metrics.alerts.inc({ channel: channelType, status });

    try {
      await this.prisma.alertDelivery.create({
        data: { ruleId: rule.id, channelId: rule.channelId, incidentId, trigger, status, error },
      });
    } catch {
      // The audit row is best effort; losing it must not break the pipeline.
    }
  }

  private get encryptionKey() {
    return resolveEncryptionKey(this.config.get<string>('ALERT_ENCRYPTION_KEY'));
  }

  private messageFor(input: {
    incident: Incident;
    service: Service;
    trigger: AlertTrigger;
  }): AlertMessageInput {
    const baseUrl = this.config.get<string>('DASHBOARD_URL')?.replace(/\/$/, '');

    return {
      trigger: input.trigger,
      incidentId: input.incident.id,
      title: input.incident.title,
      severity: input.incident.severity,
      serviceName: input.service.name,
      environment: input.service.environment,
      occurrenceCount: input.incident.occurrenceCount,
      recentCount: input.incident.recentCount,
      lastSeenAt: input.incident.lastSeenAt,
      dashboardUrl: baseUrl ? `${baseUrl}/incidents/${input.incident.id}` : undefined,
    };
  }
}
