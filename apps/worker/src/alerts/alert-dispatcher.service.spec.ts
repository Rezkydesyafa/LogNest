import { ConfigService } from '@nestjs/config';
import { AlertTrigger, Incident, IncidentSeverity, Service } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsService, PinoLogger, PrismaService, RedisService } from '../../../../packages/shared/src';
import { AlertDispatcherService } from './alert-dispatcher.service';

const incident = {
  id: 'incident_1',
  projectId: 'project_1',
  serviceId: 'service_1',
  title: 'database timeout',
  severity: IncidentSeverity.CRITICAL,
  occurrenceCount: 42,
  recentCount: 7,
  lastSeenAt: new Date('2026-07-26T10:00:00.000Z'),
} as unknown as Incident;

const service = { id: 'service_1', name: 'payment-service', environment: 'production' } as unknown as Service;

const slackRule = {
  id: 'rule_1',
  projectId: 'project_1',
  channelId: 'channel_1',
  enabled: true,
  minSeverity: IncidentSeverity.HIGH,
  serviceIds: [],
  environments: [],
  onCreated: true,
  onSeverityIncrease: true,
  onReopened: true,
  throttleMinutes: 30,
  channel: { type: 'SLACK', config: { webhookUrl: 'https://hooks.slack.com/x' } },
};

function harness(options: {
  rules?: unknown[];
  claim?: boolean;
  fetchImpl?: ReturnType<typeof vi.fn>;
  dashboardUrl?: string;
}) {
  const created: unknown[] = [];
  const prisma = {
    alertRule: { findMany: vi.fn().mockResolvedValue(options.rules ?? [slackRule]) },
    alertDelivery: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        created.push(data);
        return data;
      }),
    },
  } as unknown as PrismaService;
  const redis = { claim: vi.fn().mockResolvedValue(options.claim ?? true) } as unknown as RedisService;
  const config = {
    get: (key: string) => (key === 'DASHBOARD_URL' ? options.dashboardUrl : undefined),
  } as unknown as ConfigService;
  const fetchImpl = options.fetchImpl ?? vi.fn().mockResolvedValue({ ok: true, status: 200 });
  const logger = { warn: vi.fn(), log: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
  const metrics = { alerts: { inc: vi.fn() } } as unknown as MetricsService;

  return {
    dispatcher: new AlertDispatcherService(
      prisma,
      redis,
      config,
      logger,
      metrics,
      fetchImpl as unknown as typeof fetch,
    ),
    metrics,
    prisma,
    redis,
    fetchImpl,
    deliveries: created as Array<{ status: string; trigger: string; error?: string }>,
  };
}

const event = { incident, service, trigger: AlertTrigger.CREATED };

describe('AlertDispatcherService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delivers to a matching rule and records the outcome', async () => {
    const { dispatcher, fetchImpl, deliveries } = harness({});

    await expect(dispatcher.dispatch(event)).resolves.toEqual({ matched: 1, sent: 1 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe('https://hooks.slack.com/x');
    expect(deliveries[0]).toMatchObject({ status: 'SENT', trigger: 'CREATED', incidentId: 'incident_1' });
  });

  it('does nothing when no rule matches', async () => {
    const { dispatcher, fetchImpl } = harness({ rules: [] });

    await expect(dispatcher.dispatch(event)).resolves.toEqual({ matched: 0, sent: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('skips a rule whose severity floor is above the incident', async () => {
    const { dispatcher, fetchImpl } = harness({
      rules: [{ ...slackRule, minSeverity: IncidentSeverity.CRITICAL }],
    });

    await dispatcher.dispatch({ ...event, incident: { ...incident, severity: IncidentSeverity.HIGH } });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('records a throttled delivery without calling the channel', async () => {
    const { dispatcher, fetchImpl, deliveries } = harness({ claim: false });

    await expect(dispatcher.dispatch(event)).resolves.toEqual({ matched: 1, sent: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(deliveries[0]).toMatchObject({ status: 'THROTTLED' });
  });

  it('bypasses the throttle when it is set to zero', async () => {
    const { dispatcher, fetchImpl, redis } = harness({
      rules: [{ ...slackRule, throttleMinutes: 0 }],
      claim: false,
    });

    await dispatcher.dispatch(event);

    expect(redis.claim).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('records a failed delivery when the channel rejects the request', async () => {
    const { dispatcher, deliveries } = harness({
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    });

    await expect(dispatcher.dispatch(event)).resolves.toEqual({ matched: 1, sent: 0 });
    expect(deliveries[0]).toMatchObject({ status: 'FAILED', error: 'Channel responded 500' });
  });

  it('records a failed delivery when the network is down, without throwing', async () => {
    const { dispatcher, deliveries } = harness({
      fetchImpl: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });

    await expect(dispatcher.dispatch(event)).resolves.toEqual({ matched: 1, sent: 0 });
    expect(deliveries[0]).toMatchObject({ status: 'FAILED', error: 'ECONNREFUSED' });
  });

  it('records a failed delivery for a broken channel config instead of crashing', async () => {
    const { dispatcher, deliveries } = harness({
      rules: [{ ...slackRule, channel: { type: 'SLACK', config: {} } }],
    });

    await dispatcher.dispatch(event);

    expect(deliveries[0]).toMatchObject({ status: 'FAILED' });
    expect(deliveries[0].error).toMatch(/webhookUrl/);
  });

  it('keeps delivering to the remaining channels when one fails', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('discord')) throw new Error('down');
      return { ok: true, status: 200 };
    });
    const { dispatcher } = harness({
      rules: [
        slackRule,
        {
          ...slackRule,
          id: 'rule_2',
          channelId: 'channel_2',
          channel: { type: 'DISCORD', config: { webhookUrl: 'https://discord.com/api/webhooks/x' } },
        },
      ],
      fetchImpl: fetchImpl as ReturnType<typeof vi.fn>,
    });

    await expect(dispatcher.dispatch(event)).resolves.toEqual({ matched: 2, sent: 1 });
  });

  it('includes a dashboard link when one is configured', async () => {
    const { dispatcher, fetchImpl } = harness({ dashboardUrl: 'https://logmind.example.com/' });

    await dispatcher.dispatch(event);

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).text).toContain(
      'https://logmind.example.com/incidents/incident_1',
    );
  });
});
