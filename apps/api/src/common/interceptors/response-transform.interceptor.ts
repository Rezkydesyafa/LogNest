import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { REQUEST_ID_HEADER } from '../../../../../packages/shared/src';

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data) => ({
        data,
        requestId: request.headers[REQUEST_ID_HEADER],
      })),
    );
  }
}
