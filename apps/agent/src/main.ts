import Docker from 'dockerode';
import pino from 'pino';
import { loadConfig } from './config';
import { ContainerWatcher } from './container-watcher';
import { LogBatcher } from './log-batcher';
import { LogStreamer } from './log-streamer';
import { LogMindClient } from './logmind-client';

async function main() {
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
  const config = loadConfig();

  if (!config.apiKey) {
    logger.warn('LOGMIND_API_KEY is empty; docker logs will be read but not sent');
  }

  const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' });
  const client = new LogMindClient(config);
  const batcher = new LogBatcher(
    (batch) => client.sendBatch(batch),
    {
      maxBatchSize: config.batchSize,
      flushIntervalMs: config.batchIntervalMs,
      maxQueueSize: config.maxQueueSize,
    },
    (dropped) => logger.warn({ dropped }, 'log buffer overflow; oldest lines dropped'),
  );
  const streamer = new LogStreamer(docker, batcher);
  const watcher = new ContainerWatcher(docker, config, streamer);

  // Flush whatever is buffered before the container goes away.
  const shutdown = async () => {
    await batcher.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  await watcher.start();
  logger.info(
    { batchSize: config.batchSize, batchIntervalMs: config.batchIntervalMs },
    'LogMind Docker agent started',
  );
}

void main().catch((error) => {
  pino().error({ err: error }, 'LogMind Docker agent crashed');
  process.exitCode = 1;
});
