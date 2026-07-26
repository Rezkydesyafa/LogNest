import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from '../../../../../packages/shared/src';

type RequestLike = { method?: string; route?: { path?: string }; url?: string };
type ResponseLike = { statusCode?: number };

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestLike>();
    const response = http.getResponse<ResponseLike>();
    const method = request.method ?? 'GET';
    const route = routeTemplate(context, request);
    const end = this.metrics.httpDuration.startTimer({ method, route });

    const record = (status: number) => {
      end();
      this.metrics.httpRequests.inc({ method, route, status: String(status) });
    };

    return next.handle().pipe(
      tap({
        next: () => record(response.statusCode ?? 200),
        error: (error: { status?: number }) => record(error?.status ?? 500),
      }),
    );
  }
}

/**
 * Uses the route *template* (`/incidents/:incidentId`) rather than the concrete URL.
 * Labelling by raw path would create one time series per incident id and blow up cardinality.
 */
function routeTemplate(context: ExecutionContext, request: RequestLike) {
  const handlerPath = request.route?.path;
  if (handlerPath) return handlerPath;

  const controller = context.getClass?.().name ?? 'unknown';
  return `${controller}:${context.getHandler?.().name ?? 'unknown'}`;
}
