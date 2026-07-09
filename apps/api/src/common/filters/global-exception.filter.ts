import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PinoLogger, REQUEST_ID_HEADER } from '../../../../../packages/shared/src';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const error =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const requestId = request.headers[REQUEST_ID_HEADER];
    this.logger.error(
      {
        err: exception,
        method: request.method,
        path: request.url,
        requestId,
        status,
      },
      undefined,
      'request failed',
    );

    response.status(status).json({
      error,
      requestId,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
