import { AlertTrigger, IncidentSeverity } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  AlertMessageInput,
  AlertRuleMatch,
  buildAlertRequest,
  formatAlertText,
  isSeverityIncrease,
  redactChannelConfig,
  ruleMatches,
} from './alerting';

const rule: AlertRuleMatch = {
  enabled: true,
  minSeverity: IncidentSeverity.HIGH,
  serviceIds: [],
  environments: [],
  onCreated: true,
  onSeverityIncrease: true,
  onReopened: true,
};

const event = {
  trigger: AlertTrigger.CREATED,
  severity: IncidentSeverity.HIGH,
  serviceId: 'service_1',
  environment: 'production',
};

describe('ruleMatches', () => {
  it('fires for a matching event', () => {
    expect(ruleMatches(rule, event)).toBe(true);
  });

  it('never fires for a disabled rule', () => {
    expect(ruleMatches({ ...rule, enabled: false }, event)).toBe(false);
  });

  it('applies the minimum severity as a floor, not an exact match', () => {
    expect(ruleMatches(rule, { ...event, severity: IncidentSeverity.CRITICAL })).toBe(true);
    expect(ruleMatches(rule, { ...event, severity: IncidentSeverity.MEDIUM })).toBe(false);
    expect(ruleMatches({ ...rule, minSeverity: IncidentSeverity.LOW }, { ...event, severity: 'LOW' })).toBe(
      true,
    );
  });

  it('treats an empty scope as "any"', () => {
    expect(ruleMatches(rule, { ...event, serviceId: 'anything', environment: 'anything' })).toBe(true);
  });

  it('honours the service scope', () => {
    expect(ruleMatches({ ...rule, serviceIds: ['service_1'] }, event)).toBe(true);
    expect(ruleMatches({ ...rule, serviceIds: ['service_2'] }, event)).toBe(false);
  });

  it('honours the environment scope', () => {
    expect(ruleMatches({ ...rule, environments: ['production'] }, event)).toBe(true);
    expect(ruleMatches({ ...rule, environments: ['staging'] }, event)).toBe(false);
  });

  it.each([
    [AlertTrigger.CREATED, 'onCreated'],
    [AlertTrigger.SEVERITY_INCREASED, 'onSeverityIncrease'],
    [AlertTrigger.REOPENED, 'onReopened'],
  ] as const)('respects the %s toggle', (trigger, flag) => {
    expect(ruleMatches(rule, { ...event, trigger })).toBe(true);
    expect(ruleMatches({ ...rule, [flag]: false }, { ...event, trigger })).toBe(false);
  });
});

describe('isSeverityIncrease', () => {
  it('only counts a move up the scale', () => {
    expect(isSeverityIncrease(IncidentSeverity.HIGH, IncidentSeverity.CRITICAL)).toBe(true);
    expect(isSeverityIncrease(IncidentSeverity.CRITICAL, IncidentSeverity.HIGH)).toBe(false);
    expect(isSeverityIncrease(IncidentSeverity.HIGH, IncidentSeverity.HIGH)).toBe(false);
  });
});

const message: AlertMessageInput = {
  trigger: AlertTrigger.CREATED,
  incidentId: 'incident_1',
  title: 'database timeout',
  severity: IncidentSeverity.CRITICAL,
  serviceName: 'payment-service',
  environment: 'production',
  occurrenceCount: 42,
  recentCount: 7,
  lastSeenAt: new Date('2026-07-26T10:00:00.000Z'),
  dashboardUrl: 'https://logmind.example.com/incidents/incident_1',
};

describe('formatAlertText', () => {
  it('includes the incident essentials and the link', () => {
    const text = formatAlertText(message);

    expect(text).toContain('New incident: database timeout');
    expect(text).toContain('payment-service (production)');
    expect(text).toContain('Severity: CRITICAL');
    expect(text).toContain('42 total, 7 in the last 10 minutes');
    expect(text).toContain('https://logmind.example.com/incidents/incident_1');
  });

  it('omits the link line when no dashboard url is configured', () => {
    expect(formatAlertText({ ...message, dashboardUrl: undefined })).not.toContain('Details:');
  });

  it('labels each trigger differently', () => {
    expect(formatAlertText({ ...message, trigger: AlertTrigger.REOPENED })).toContain('Incident reopened');
    expect(formatAlertText({ ...message, trigger: AlertTrigger.SEVERITY_INCREASED })).toContain(
      'Incident escalated',
    );
  });
});

describe('buildAlertRequest', () => {
  it('builds a Slack webhook post', () => {
    const request = buildAlertRequest('SLACK', { webhookUrl: 'https://hooks.slack.com/x' }, message);

    expect(request.url).toBe('https://hooks.slack.com/x');
    expect(request.body).toMatchObject({ text: expect.stringContaining('database timeout') });
  });

  it('builds a Discord webhook post', () => {
    const request = buildAlertRequest(
      'DISCORD',
      { webhookUrl: 'https://discord.com/api/webhooks/x' },
      message,
    );

    expect(request.body).toMatchObject({ content: expect.stringContaining('database timeout') });
  });

  it('builds a Telegram sendMessage call', () => {
    const request = buildAlertRequest('TELEGRAM', { botToken: '123:abc', chatId: '-100' }, message);

    expect(request.url).toBe('https://api.telegram.org/bot123:abc/sendMessage');
    expect(request.body).toMatchObject({ chat_id: '-100' });
  });

  it('builds a structured generic webhook post with custom headers', () => {
    const request = buildAlertRequest(
      'WEBHOOK',
      { url: 'https://ops.example.com/hook', headers: { 'x-token': 'abc', bad: 1 } },
      message,
    );

    expect(request.url).toBe('https://ops.example.com/hook');
    expect(request.headers).toEqual({ 'x-token': 'abc' });
    expect(request.body).toMatchObject({
      incidentId: 'incident_1',
      severity: 'CRITICAL',
      lastSeenAt: '2026-07-26T10:00:00.000Z',
    });
  });

  it.each([
    ['SLACK', {}],
    ['DISCORD', {}],
    ['TELEGRAM', { botToken: '123:abc' }],
    ['WEBHOOK', {}],
  ] as const)('rejects an incomplete %s config', (type, config) => {
    expect(() => buildAlertRequest(type, config, message)).toThrow(/missing/);
  });
});

describe('redactChannelConfig', () => {
  it('hides secrets but keeps the harmless fields', () => {
    expect(
      redactChannelConfig({ webhookUrl: 'https://hooks.slack.com/x', chatId: '-100', botToken: 't' }),
    ).toEqual({
      webhookUrl: '[configured]',
      chatId: '-100',
      botToken: '[configured]',
    });
  });

  it('tolerates a missing or non-object config', () => {
    expect(redactChannelConfig(null)).toEqual({});
    expect(redactChannelConfig('nope')).toEqual({});
  });
});
