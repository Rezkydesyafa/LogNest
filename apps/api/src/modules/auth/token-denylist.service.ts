import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../../packages/shared/src';

/**
 * Immediate revocation for access tokens that have not expired yet.
 *
 * Access tokens are stateless, so logout would otherwise leave a valid token in the wild
 * until it expires. Denied `jti` values live in Redis only until the token would have
 * expired anyway, which bounds the list without any cleanup job.
 */
@Injectable()
export class TokenDenylistService {
  constructor(private readonly redis: RedisService) {}

  async deny(jti: string, expiresAtSeconds?: number) {
    const ttlMs = remainingMs(expiresAtSeconds);
    if (ttlMs <= 0) return;

    await this.redis.setJson(this.key(jti), 1, ttlMs);
  }

  async isDenied(jti?: string) {
    if (!jti) return false;
    return (await this.redis.getJson<number>(this.key(jti))) !== undefined;
  }

  private key(jti: string) {
    return `denylist:jti:${jti}`;
  }
}

function remainingMs(expiresAtSeconds?: number) {
  if (!expiresAtSeconds) return 0;
  return expiresAtSeconds * 1000 - Date.now();
}
