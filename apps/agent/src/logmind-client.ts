import { AgentConfig } from './config';

export type DockerLogPayload = {
  sourceType: 'docker';
  serviceName: string;
  environment: string;
  level: 'info' | 'error';
  message: string;
  stackTrace?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

type ClientConfig = Pick<
  AgentConfig,
  'apiKey' | 'endpoint' | 'bulkEndpoint' | 'retryAttempts' | 'retryDelayMs'
>;

export class LogMindClient {
  constructor(
    private readonly config: ClientConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(payload: DockerLogPayload) {
    return this.post(this.config.endpoint, payload);
  }

  /** Delivers a whole batch in one request. Falls back to single sends on a 404 bulk route. */
  async sendBatch(batch: DockerLogPayload[]) {
    if (!batch.length) return true;
    if (batch.length === 1) return this.send(batch[0]);

    const delivered = await this.post(this.config.bulkEndpoint, { logs: batch });
    if (delivered !== 'unsupported') return delivered;

    // Older API without /logs/ingest/bulk: degrade instead of dropping the batch.
    const results = await Promise.all(batch.map((payload) => this.send(payload)));
    return results.every(Boolean);
  }

  private async post(url: string, body: unknown) {
    if (!this.config.apiKey) return false;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.config.apiKey,
          },
          body: JSON.stringify(body),
        });

        if (response.ok) return true;
        if (response.status === 404) return 'unsupported' as const;
        // A rejected payload will be rejected again; only retry transient failures.
        if (response.status >= 400 && response.status < 500 && response.status !== 429) return false;
      } catch {
        // retry below
      }

      if (attempt < this.config.retryAttempts) {
        await sleep(this.config.retryDelayMs * attempt);
      }
    }

    return false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
