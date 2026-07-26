import { DemoConfig } from './config';
import { DemoScenario, pickScenario, SCENARIOS } from './scenarios';

export type TrafficOptions = {
  fetchImpl?: typeof fetch;
  random?: () => number;
  log?: (message: string, context: Record<string, unknown>) => void;
};

/**
 * Drives the service's own endpoints on an interval.
 *
 * A portfolio demo has no real users, so without this nothing would ever appear in the
 * dashboard. Requests go over HTTP to the service itself rather than calling the handlers
 * directly, so the Express middleware records them exactly as it would in production.
 */
export class TrafficGenerator {
  private timer?: NodeJS.Timeout;
  private readonly fetchImpl: typeof fetch;
  private readonly random: () => number;
  private readonly log: (message: string, context: Record<string, unknown>) => void;

  constructor(
    private readonly config: DemoConfig,
    options: TrafficOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.random = options.random ?? Math.random;
    // Also written to stdout, which is what the Docker agent collects.
    this.log = options.log ?? ((message, context) => console.log(JSON.stringify({ message, ...context })));
  }

  start() {
    if (!this.config.trafficEnabled || this.timer) return;

    this.timer = setInterval(() => void this.tick(), this.config.trafficIntervalMs);
    this.timer.unref?.();
  }

  /** Sends one request. Exposed so a test can drive it without waiting on the timer. */
  async tick() {
    const scenario = pickScenario(SCENARIOS[this.config.service], this.random());
    const fail = this.random() < this.config.errorRate;

    try {
      const response = await this.request(scenario, fail);
      this.log('demo traffic', {
        service: this.config.serviceName,
        path: scenario.path,
        method: scenario.method,
        status: response.status,
      });
      return response.status;
    } catch (error) {
      // The service is still starting, or the port is busy. Not worth crashing the demo.
      this.log('demo traffic failed', {
        service: this.config.serviceName,
        path: scenario.path,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  private request(scenario: DemoScenario, fail: boolean) {
    return this.fetchImpl(`http://127.0.0.1:${this.config.port}${scenario.path}`, {
      method: scenario.method,
      headers: {
        'content-type': 'application/json',
        'x-demo-outcome': fail ? 'fail' : 'ok',
      },
      body: scenario.method === 'GET' ? undefined : JSON.stringify(scenario.body ?? {}),
    });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
