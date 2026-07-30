export type AgentConfig = {
  apiKey: string;
  endpoint: string;
  bulkEndpoint: string;
  selfContainerId?: string;
  composeProjects: string[];
  composeServices: string[];
  excludedComposeProjects: string[];
  defaultEnvironment: string;
  retryAttempts: number;
  retryDelayMs: number;
  batchSize: number;
  batchIntervalMs: number;
  maxQueueSize: number;
};

export function loadConfig(env = process.env): AgentConfig {
  const endpoint = env.LOGMIND_INGEST_ENDPOINT ?? 'http://localhost:3000/logs/ingest';

  return {
    apiKey: env.LOGMIND_API_KEY ?? '',
    endpoint,
    bulkEndpoint: env.LOGMIND_BULK_INGEST_ENDPOINT ?? `${endpoint.replace(/\/$/, '')}/bulk`,
    selfContainerId: env.LOGMIND_AGENT_CONTAINER_ID,
    composeProjects: list(env.LOGMIND_COMPOSE_PROJECTS),
    composeServices: list(env.LOGMIND_COMPOSE_SERVICES),
    excludedComposeProjects:
      env.LOGMIND_EXCLUDE_COMPOSE_PROJECTS === undefined
        ? ['logmind']
        : list(env.LOGMIND_EXCLUDE_COMPOSE_PROJECTS),
    defaultEnvironment: env.LOGMIND_DEFAULT_ENVIRONMENT || 'development',
    retryAttempts: positiveNumber(env.LOGMIND_AGENT_RETRY_ATTEMPTS, 3),
    retryDelayMs: positiveNumber(env.LOGMIND_AGENT_RETRY_DELAY_MS, 1000),
    batchSize: bounded(env.LOGMIND_AGENT_BATCH_SIZE, 100, 1, 500),
    batchIntervalMs: positiveNumber(env.LOGMIND_AGENT_BATCH_INTERVAL_MS, 1000),
    maxQueueSize: positiveNumber(env.LOGMIND_AGENT_MAX_QUEUE, 10000),
  };
}

function list(value?: string) {
  return (
    value
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** The API rejects batches above its own cap, so the agent never proposes a larger one. */
function bounded(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = positiveNumber(value, fallback);
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
