import { PassThrough, Readable } from 'stream';
import Docker from 'dockerode';
import { environmentFromLabels, serviceNameFromLabels } from './labels';
import { LineBuffer } from './line-buffer';
import { LogMindClient } from './logmind-client';

type ContainerInfo = {
  id: string;
  name: string;
  image: string;
  labels: Record<string, string | undefined>;
  composeProject?: string;
};

export class LogStreamer {
  constructor(
    private readonly docker: Docker,
    private readonly client: LogMindClient,
  ) {}

  async stream(container: Docker.Container, info: ContainerInfo) {
    const details = await container.inspect();
    const stream = (await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail: 0,
      timestamps: false,
    })) as Readable;

    if (details.Config?.Tty) {
      this.consume(stream, 'info', info);
      return;
    }

    const stdout = new PassThrough();
    const stderr = new PassThrough();
    container.modem.demuxStream(stream, stdout, stderr);
    this.consume(stdout, 'info', info);
    this.consume(stderr, 'error', info);
  }

  private consume(stream: Readable, level: 'info' | 'error', info: ContainerInfo) {
    const buffer = new LineBuffer();
    stream.on('data', (chunk) => {
      for (const line of buffer.push(chunk)) {
        void this.sendLine(line, level, info);
      }
    });
    stream.on('end', () => {
      for (const line of buffer.flush()) {
        void this.sendLine(line, level, info);
      }
    });
    stream.on('error', () => undefined);
  }

  private sendLine(line: string, level: 'info' | 'error', info: ContainerInfo) {
    return this.client.send({
      sourceType: 'docker',
      serviceName: serviceNameFromLabels(info.labels, info.name),
      environment: environmentFromLabels(info.labels),
      level,
      message: line,
      timestamp: new Date().toISOString(),
      metadata: {
        container: {
          id: info.id,
          name: info.name,
          image: info.image,
          labels: info.labels,
          composeProject: info.composeProject,
          stream: level === 'error' ? 'stderr' : 'stdout',
        },
      },
    });
  }
}
