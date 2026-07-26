import { createServer, Server } from 'http';
import { timingSafeEqual } from 'crypto';
import { MetricsService } from '../../../../packages/shared/src';

export type MetricsServerOptions = { port: number; token?: string };

/**
 * Minimal scrape endpoint for the worker.
 *
 * The worker is a queue consumer with no HTTP surface, but Prometheus is pull-based, so it
 * needs somewhere to scrape. A bare `http` server keeps the worker from taking on a web
 * framework just to serve two routes.
 */
export function startMetricsServer(metrics: MetricsService, options: MetricsServerOptions): Server {
  const server = createServer((request, response) => {
    const path = (request.url ?? '').split('?')[0];

    if (path === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (path !== '/metrics') {
      response.writeHead(404).end();
      return;
    }

    if (options.token && !matchesToken(request.headers.authorization, options.token)) {
      response.writeHead(403).end();
      return;
    }

    void metrics
      .render()
      .then((body) => {
        response.writeHead(200, { 'content-type': metrics.contentType, 'cache-control': 'no-store' });
        response.end(body);
      })
      .catch(() => response.writeHead(500).end());
  });

  server.listen(options.port);
  return server;
}

function matchesToken(authorization: string | undefined, expected: string) {
  const provided = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}
