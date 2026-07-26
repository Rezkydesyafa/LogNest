import { AlertChannelType, AlertTrigger, IncidentSeverity } from '@prisma/client';

export const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export type AlertRuleMatch = {
  enabled: boolean;
  minSeverity: IncidentSeverity;
  serviceIds: string[];
  environments: string[];
  onCreated: boolean;
  onSeverityIncrease: boolean;
  onReopened: boolean;
};

export type AlertEvent = {
  trigger: AlertTrigger;
  severity: IncidentSeverity;
  serviceId: string;
  environment: string;
};

/** True when this rule should fire for this incident event. Empty scope arrays mean "any". */
export function ruleMatches(rule: AlertRuleMatch, event: AlertEvent) {
  if (!rule.enabled) return false;
  if (SEVERITY_RANK[event.severity] < SEVERITY_RANK[rule.minSeverity]) return false;
  if (rule.serviceIds.length && !rule.serviceIds.includes(event.serviceId)) return false;
  if (rule.environments.length && !rule.environments.includes(event.environment)) return false;

  return triggerEnabled(rule, event.trigger);
}

export function triggerEnabled(rule: AlertRuleMatch, trigger: AlertTrigger) {
  if (trigger === 'CREATED') return rule.onCreated;
  if (trigger === 'SEVERITY_INCREASED') return rule.onSeverityIncrease;
  if (trigger === 'REOPENED') return rule.onReopened;
  return false;
}

export function isSeverityIncrease(previous: IncidentSeverity, next: IncidentSeverity) {
  return SEVERITY_RANK[next] > SEVERITY_RANK[previous];
}

export type AlertMessageInput = {
  trigger: AlertTrigger;
  incidentId: string;
  title: string;
  severity: IncidentSeverity;
  serviceName: string;
  environment: string;
  occurrenceCount: number;
  recentCount: number;
  lastSeenAt: Date;
  dashboardUrl?: string;
};

const TRIGGER_LABEL: Record<AlertTrigger, string> = {
  CREATED: 'New incident',
  SEVERITY_INCREASED: 'Incident escalated',
  REOPENED: 'Incident reopened',
};

const SEVERITY_EMOJI: Record<IncidentSeverity, string> = {
  LOW: '🔵',
  MEDIUM: '🟡',
  HIGH: '🟠',
  CRITICAL: '🔴',
};

/** Plain-text rendering shared by every channel, so one incident reads the same everywhere. */
export function formatAlertText(input: AlertMessageInput) {
  const lines = [
    `${SEVERITY_EMOJI[input.severity]} ${TRIGGER_LABEL[input.trigger]}: ${input.title}`,
    `Service: ${input.serviceName} (${input.environment})`,
    `Severity: ${input.severity}`,
    `Occurrences: ${input.occurrenceCount} total, ${input.recentCount} in the last 10 minutes`,
    `Last seen: ${input.lastSeenAt.toISOString()}`,
  ];

  if (input.dashboardUrl) lines.push(`Details: ${input.dashboardUrl}`);

  return lines.join('\n');
}

/** Channel-specific request body for one alert. */
export function buildAlertRequest(
  type: AlertChannelType,
  config: Record<string, unknown>,
  input: AlertMessageInput,
): { url: string; body: unknown; headers?: Record<string, string> } {
  const text = formatAlertText(input);

  if (type === 'SLACK') {
    return { url: requireString(config, 'webhookUrl'), body: { text } };
  }

  if (type === 'DISCORD') {
    return { url: requireString(config, 'webhookUrl'), body: { content: text } };
  }

  if (type === 'TELEGRAM') {
    const token = requireString(config, 'botToken');
    return {
      url: `https://api.telegram.org/bot${token}/sendMessage`,
      body: { chat_id: requireString(config, 'chatId'), text, disable_web_page_preview: true },
    };
  }

  // WEBHOOK: send the structured event so the receiver can route it however it likes.
  return {
    url: requireString(config, 'url'),
    headers: headerRecord(config.headers),
    body: {
      trigger: input.trigger,
      incidentId: input.incidentId,
      title: input.title,
      severity: input.severity,
      serviceName: input.serviceName,
      environment: input.environment,
      occurrenceCount: input.occurrenceCount,
      recentCount: input.recentCount,
      lastSeenAt: input.lastSeenAt.toISOString(),
      dashboardUrl: input.dashboardUrl,
      text,
    },
  };
}

/** Fields that must never leave the API. Everything else in `config` is safe to show. */
const SECRET_CONFIG_KEYS = ['webhookUrl', 'botToken', 'url', 'headers'];

export function redactChannelConfig(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== 'object') return {};

  return Object.fromEntries(
    Object.entries(config as Record<string, unknown>).map(([key, value]) => [
      key,
      SECRET_CONFIG_KEYS.includes(key) ? '[configured]' : value,
    ]),
  );
}

function requireString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  if (typeof value !== 'string' || !value) {
    throw new Error(`Alert channel config is missing "${key}"`);
  }
  return value;
}

function headerRecord(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => typeof entry === 'string')
      .map(([key, entry]) => [key, String(entry)]),
  );
}
