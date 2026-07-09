import { AgentConfig } from './config';

export type DockerLogPayload = {
  sourceType: 'docker';
  serviceName: string;
  environment: string;
  level: 'info' | 'error';
  message: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export class LogMindClient {
  constructor(
    private readonly config: AgentConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(payload: DockerLogPayload) {
    if (!this.config.apiKey) return false;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(this.config.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.config.apiKey,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) return true;
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
