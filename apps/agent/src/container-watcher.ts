import Docker from 'dockerode';
import { AgentConfig } from './config';
import { isAgentContainer, isLogmindEnabled } from './labels';
import { LineBuffer } from './line-buffer';
import { LogStreamer } from './log-streamer';

export class ContainerWatcher {
  private readonly watched = new Set<string>();

  constructor(
    private readonly docker: Docker,
    private readonly config: AgentConfig,
    private readonly streamer: LogStreamer,
  ) {}

  async start() {
    await this.watchExisting();
    await this.watchEvents();
  }

  async watchExisting() {
    const containers = await this.docker.listContainers({
      all: false,
      filters: { label: ['logmind.enabled=true'] },
    });

    await Promise.all(containers.map((container) => this.watchContainer(container.Id)));
  }

  private async watchEvents() {
    const stream = await this.docker.getEvents({
      filters: {
        type: ['container'],
        event: ['start'],
        label: ['logmind.enabled=true'],
      },
    });

    const buffer = new LineBuffer();
    stream.on('data', (chunk) => {
      for (const line of buffer.push(chunk)) {
        const event = parseDockerEvent(line);
        if (event?.id) void this.watchContainer(event.id);
      }
    });
    stream.on('end', () => {
      for (const line of buffer.flush()) {
        const event = parseDockerEvent(line);
        if (event?.id) void this.watchContainer(event.id);
      }
    });
  }

  private async watchContainer(containerId: string) {
    if (this.watched.has(containerId)) return;

    try {
      const container = this.docker.getContainer(containerId);
      const details = await container.inspect();
      const labels = details.Config?.Labels ?? {};

      if (!isLogmindEnabled(labels) || isAgentContainer(details.Id, labels, this.config.selfContainerId)) {
        return;
      }

      this.watched.add(containerId);
      await this.streamer.stream(container, {
        id: details.Id,
        name: details.Name?.replace(/^\//, '') || details.Id.slice(0, 12),
        image: details.Config?.Image ?? '',
        labels,
        composeProject: labels['com.docker.compose.project'],
      });
    } catch {
      this.watched.delete(containerId);
    }
  }
}

function parseDockerEvent(line: string) {
  try {
    return JSON.parse(line) as { id?: string };
  } catch {
    return undefined;
  }
}
