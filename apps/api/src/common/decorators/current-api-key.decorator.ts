import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyContext } from '../types/auth.types';

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const request = ctx.switchToHttp().getRequest<{ apiKey: ApiKeyContext }>();
    return request.apiKey;
  },
);
