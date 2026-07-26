import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../../../packages/shared/src';

const DEFAULT_TTL_DAYS = 30;

export type RefreshContext = { ip?: string; userAgent?: string };

/**
 * Issues, rotates, and revokes refresh tokens.
 *
 * Tokens are stored as SHA-256 hashes: they carry 256 bits of entropy, so a salt buys
 * nothing, but a leaked database dump still cannot be replayed. Every use rotates the
 * token, and reusing a rotated token revokes the whole family — the standard detection for
 * a stolen token being replayed alongside the legitimate one.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get ttlMs() {
    const days = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS'));
    return (Number.isFinite(days) && days > 0 ? days : DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000;
  }

  async issue(userId: string, context: RefreshContext = {}) {
    const token = randomBytes(32).toString('base64url');

    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + this.ttlMs),
        ip: context.ip,
        userAgent: context.userAgent?.slice(0, 255),
      },
      select: { id: true, expiresAt: true },
    });

    return { token, id: record.id, expiresAt: record.expiresAt };
  }

  /** Consumes a refresh token and returns its owner plus a freshly issued replacement. */
  async rotate(token: string, context: RefreshContext = {}) {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(token) },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true, replacedById: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt || existing.replacedById) {
      // Replay of an already-rotated token: assume the family is compromised.
      await this.revokeAllForUser(existing.userId);
      throw new UnauthorizedException('Refresh token was already used');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const next = await this.issue(existing.userId, context);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: next.id },
    });

    return { userId: existing.userId, ...next };
  }

  async revoke(token: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count > 0;
  }

  /** Logout everywhere: used on password change and on replay detection. */
  async revokeAllForUser(userId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }

  /** Expired rows are dead weight; callers run this on a schedule. */
  async purgeExpired(now = new Date()) {
    const result = await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } });
    return result.count;
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
