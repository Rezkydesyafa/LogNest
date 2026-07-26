import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuditActor } from '../services/audit.service';
import { CurrentUserPayload } from '../types/auth.types';

/**
 * Who is performing this request, for the audit trail.
 *
 * Bundles identity with request origin so services take one argument instead of three, and
 * so no controller forgets to record the IP.
 */
export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): AuditActor => {
  const request = context.switchToHttp().getRequest<{
    user?: CurrentUserPayload;
    ip?: string;
    socket?: { remoteAddress?: string };
    headers?: Record<string, string | string[] | undefined>;
  }>();
  const userAgent = request.headers?.['user-agent'];

  return {
    id: request.user?.id,
    email: request.user?.email,
    ip: request.ip ?? request.socket?.remoteAddress,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
  };
});
