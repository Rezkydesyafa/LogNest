import { createDemoApp } from './app';
import { loadDemoConfig } from './config';
import { TrafficGenerator } from './traffic';

function main() {
  const config = loadDemoConfig();

  if (!config.logmindApiKey) {
    console.warn(`[${config.serviceName}] LOGMIND_API_KEY is empty; API logs will not be forwarded`);
  }

  const server = createDemoApp(config).listen(config.port, () => {
    console.log(
      JSON.stringify({
        message: 'demo service started',
        service: config.serviceName,
        environment: config.environment,
        port: config.port,
      }),
    );
  });

  const traffic = new TrafficGenerator(config);
  traffic.start();

  const shutdown = () => {
    traffic.stop();
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
