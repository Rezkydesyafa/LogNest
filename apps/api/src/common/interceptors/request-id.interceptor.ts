import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { REQUEST_ID_HEADER } from '../../../../../packages/shared/src';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const incomingRequestId = request.headers[REQUEST_ID_HEADER];
    const requestId = Array.isArray(incomingRequestId)
      ? incomingRequestId[0] ?? randomUUID()
      : incomingRequestId ?? randomUUID();

    request.headers[REQUEST_ID_HEADER] = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    return next.handle();
  }
}
