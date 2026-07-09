import Docker from 'dockerode';
import pino from 'pino';
import { loadConfig } from './config';
import { ContainerWatcher } from './container-watcher';
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
  const streamer = new LogStreamer(docker, client);
  const watcher = new ContainerWatcher(docker, config, streamer);

  await watcher.start();
  logger.info('LogMind Docker agent started');
}

void main().catch((error) => {
  pino().error({ err: error }, 'LogMind Docker agent crashed');
  process.exitCode = 1;
});
