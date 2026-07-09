import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../modules/auth/auth.service';
import { CurrentUserPayload } from '../types/auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: CurrentUserPayload;
    }>();
    const header = request.headers.authorization;
    const authorization = Array.isArray(header) ? header[0] : header;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required');
    }

    request.user = await this.authService.verifyAccessToken(authorization.slice(7));
    return true;
  }
}
