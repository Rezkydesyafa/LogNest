export type AgentConfig = {
  apiKey: string;
  endpoint: string;
  selfContainerId?: string;
  retryAttempts: number;
  retryDelayMs: number;
};

export function loadConfig(env = process.env): AgentConfig {
  return {
    apiKey: env.LOGMIND_API_KEY ?? '',
    endpoint: env.LOGMIND_INGEST_ENDPOINT ?? 'http://localhost:3000/logs/ingest',
    selfContainerId: env.LOGMIND_AGENT_CONTAINER_ID,
    retryAttempts: positiveNumber(env.LOGMIND_AGENT_RETRY_ATTEMPTS, 3),
    retryDelayMs: positiveNumber(env.LOGMIND_AGENT_RETRY_DELAY_MS, 1000),
  };
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
