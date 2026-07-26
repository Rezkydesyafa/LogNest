export const DEMO_SERVICES = ['auth', 'payment', 'order'] as const;
export type DemoServiceName = (typeof DEMO_SERVICES)[number];

export type DemoConfig = {
  service: DemoServiceName;
  serviceName: string;
  environment: string;
  port: number;
  /** LogMind ingestion endpoint used by the Express middleware. */
  logmindEndpoint: string;
  logmindApiKey: string;
  /** Background traffic so the demo produces logs without anyone clicking. */
  trafficEnabled: boolean;
  trafficIntervalMs: number;
  /** Share of generated requests that deliberately fail, as a fraction of 1. */
  errorRate: number;
};

export function loadDemoConfig(env = process.env): DemoConfig {
  const service = demoService(env.DEMO_SERVICE);

  return {
    service,
    serviceName: env.DEMO_SERVICE_NAME || `demo-${service}-service`,
    environment: env.DEMO_ENVIRONMENT || 'development',
    port: positiveNumber(env.PORT, 4000),
    logmindEndpoint: env.LOGMIND_INGEST_ENDPOINT || 'http://localhost:3000/logs/ingest',
    logmindApiKey: env.LOGMIND_API_KEY ?? '',
    trafficEnabled: env.DEMO_TRAFFIC_ENABLED !== 'false',
    trafficIntervalMs: positiveNumber(env.DEMO_TRAFFIC_INTERVAL_MS, 4000),
    errorRate: fraction(env.DEMO_ERROR_RATE, 0.25),
  };
}

function demoService(value?: string): DemoServiceName {
  const normalized = (value ?? '').toLowerCase() as DemoServiceName;
  return DEMO_SERVICES.includes(normalized) ? normalized : 'auth';
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function fraction(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}
