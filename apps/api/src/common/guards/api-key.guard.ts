import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';
import { ApiKeyContext } from '../types/auth.types';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      apiKey?: ApiKeyContext;
    }>();
    const header = request.headers['x-api-key'];
    const rawKey = Array.isArray(header) ? header[0] : header;

    if (!rawKey) {
      throw new UnauthorizedException('API key is required');
    }

    request.apiKey = await this.apiKeysService.validateRawKey(rawKey);
    return true;
  }
}
