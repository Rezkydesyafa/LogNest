import { PassThrough, Readable } from 'stream';
import Docker from 'dockerode';
import { environmentFromLabels, serviceNameFromLabels } from './labels';
import { LineBuffer, MultilineBuffer } from './line-buffer';
import { LogBatcher } from './log-batcher';
import { DockerLogPayload } from './logmind-client';

type ContainerInfo = {
  id: string;
  name: string;
  image: string;
  labels: Record<string, string | undefined>;
  composeProject?: string;
  defaultEnvironment: string;
};

export class LogStreamer {
  constructor(
    private readonly docker: Docker,
    private readonly batcher: LogBatcher,
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
    const multiline = new MultilineBuffer();
    stream.on('data', (chunk) => {
      for (const line of buffer.push(chunk)) {
        for (const entry of multiline.push(line)) this.enqueue(entry, level, info);
      }
    });
    stream.on('end', () => {
      for (const line of buffer.flush()) {
        for (const entry of multiline.push(line)) this.enqueue(entry, level, info);
      }
      for (const entry of multiline.flush()) this.enqueue(entry, level, info);
    });
    stream.on('error', () => undefined);
  }

  private enqueue(line: string, level: 'info' | 'error', info: ContainerInfo) {
    this.batcher.add(this.toPayload(line, level, info));
  }

  private toPayload(line: string, level: 'info' | 'error', info: ContainerInfo): DockerLogPayload {
    const stackTrace = line.includes('\n') ? line : undefined;
    return {
      sourceType: 'docker',
      serviceName: serviceNameFromLabels(info.labels, info.name),
      environment: environmentFromLabels(info.labels, info.defaultEnvironment),
      level,
      message: stackTrace ? line.split('\n').at(-1) || line : line,
      stackTrace,
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
    };
  }
}
