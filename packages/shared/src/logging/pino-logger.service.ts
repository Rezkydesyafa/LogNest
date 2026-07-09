import { Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';

@Injectable()
export class PinoLogger implements LoggerService {
  private readonly logger: Logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
  });

  log(message: unknown, context?: string) {
    this.logger.info(this.payload(message, context));
  }

  error(message: unknown, trace?: string, context?: string) {
    this.logger.error(this.payload(message, context, trace));
  }

  warn(message: unknown, context?: string) {
    this.logger.warn(this.payload(message, context));
  }

  debug(message: unknown, context?: string) {
    this.logger.debug(this.payload(message, context));
  }

  verbose(message: unknown, context?: string) {
    this.logger.trace(this.payload(message, context));
  }

  private payload(message: unknown, context?: string, trace?: string) {
    if (typeof message === 'string') {
      return { msg: message, context, trace };
    }

    if (message instanceof Error) {
      return { err: message, context, trace };
    }

    if (message && typeof message === 'object') {
      return { ...(message as Record<string, unknown>), context, trace };
    }

    return { value: message, context, trace };
  }
}
