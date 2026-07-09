import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { ApiKeyType } from '@prisma/client';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';
import { ApiKeyContext } from '../types/auth.types';

@Injectable()
export class ClientApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      apiKey?: ApiKeyContext;
    }>();
    const header = request.headers['x-api-key'];
    const rawKey = Array.isArray(header) ? header[0] : header;
    const apiKey = await this.apiKeysService.validateRawKey(rawKey);

    if (apiKey.type !== ApiKeyType.CLIENT) {
      throw new ForbiddenException('Client API key is required');
    }

    request.apiKey = apiKey;
    return true;
  }
}
