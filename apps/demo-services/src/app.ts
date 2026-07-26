import express, { NextFunction, Request, Response } from 'express';
import { logmindApiLogger } from '../../../packages/api-logger-express/src';
import { DemoConfig } from './config';
import { DemoScenario, SCENARIOS } from './scenarios';

/**
 * Builds the demo Express app.
 *
 * Every route can succeed or fail on demand: the traffic generator sends `x-demo-outcome:
 * fail` to reproduce a specific failure, which is what makes the incident pipeline visible
 * within a couple of minutes instead of by chance.
 */
export function createDemoApp(config: DemoConfig) {
  const app = express();
  const scenarios = SCENARIOS[config.service];

  app.use(express.json({ limit: '256kb' }));
  app.use(
    logmindApiLogger({
      apiKey: config.logmindApiKey,
      serviceName: config.serviceName,
      environment: config.environment,
      endpoint: config.logmindEndpoint,
      // Proves that request bodies are captured and that secrets in them are masked.
      captureRequestBody: true,
    }),
  );

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: config.serviceName });
  });

  for (const scenario of scenarios) {
    const handler = (request: Request, response: Response, next: NextFunction) =>
      handleScenario(scenario, config, request, response, next);

    if (scenario.method === 'GET') app.get(scenario.path, handler);
    else app.post(scenario.path, handler);
  }

  // Stack traces reach LogMind through res.locals, which the middleware reads.
  app.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
    response.locals.error = error;
    response.status(500).json({ error: error.message });
  });

  return app;
}

function handleScenario(
  scenario: DemoScenario,
  config: DemoConfig,
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const outcome = String(request.headers['x-demo-outcome'] ?? '');
  const shouldFail = outcome === 'fail' || (outcome !== 'ok' && Math.random() < config.errorRate);

  if (!shouldFail) {
    response.json({ ok: true, service: config.serviceName, path: scenario.path });
    return;
  }

  // A 5xx is modelled as a thrown error so the demo also exercises stack trace capture.
  if (scenario.failureStatus >= 500) {
    next(new Error(scenario.failureMessage));
    return;
  }

  response.locals.errorMessage = scenario.failureMessage;
  response.status(scenario.failureStatus).json({ error: scenario.failureMessage });
}
