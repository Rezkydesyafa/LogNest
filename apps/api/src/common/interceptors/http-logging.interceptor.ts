import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { finalize, Observable } from 'rxjs';
import { PinoLogger, REQUEST_ID_HEADER } from '../../../../../packages/shared/src';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      finalize(() => {
        this.logger.log({
          method: request.method,
          path: request.url,
          requestId: request.headers[REQUEST_ID_HEADER],
          status: response.statusCode,
          durationMs: Date.now() - start,
        });
      }),
    );
  }
}
