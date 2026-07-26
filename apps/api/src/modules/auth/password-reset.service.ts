import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PinoLogger, PrismaService } from '../../../../../packages/shared/src';
import { HashingService } from '../../common/services/hashing.service';
import { RefreshTokenService } from './refresh-token.service';

const DEFAULT_TTL_MINUTES = 30;

export type ResetDelivery = { email: string; resetUrl: string; token: string; expiresAt: Date };

/**
 * Issues and consumes one-time password reset tokens.
 *
 * Tokens are hashed like refresh tokens, single-use, and short-lived. Delivery is left to a
 * pluggable sink: no mail provider is configured yet, so the default logs the link. Swapping
 * in SMTP later means replacing the sink, not this logic.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {}

  get ttlMs() {
    const minutes = Number(this.config.get('PASSWORD_RESET_TTL_MINUTES'));
    return (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_TTL_MINUTES) * 60_000;
  }

  /**
   * Starts a reset.
   *
   * Always resolves, whether or not the email exists: a different response for a known
   * address would turn this endpoint into an account enumeration oracle.
   */
  async request(email: string, context: { ip?: string } = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    });

    if (!user) return { requested: true };

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);

    // Any earlier outstanding request is void once a new one is issued.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: this.hash(token), expiresAt, ip: context.ip },
    });

    await this.deliver({
      email: user.email,
      token,
      expiresAt,
      resetUrl: `${this.dashboardUrl}/reset-password?token=${encodeURIComponent(token)}`,
    });

    return { requested: true };
  }

  /** Consumes the token, sets the new password, and ends every existing session. */
  async reset(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hash(token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    const passwordHash = await this.hashing.hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // A reset usually means the account was compromised, so every session must end.
    const revoked = await this.refreshTokens.revokeAllForUser(record.userId);

    return { reset: true, revokedSessions: revoked };
  }

  private get dashboardUrl() {
    return (this.config.get<string>('DASHBOARD_URL') ?? 'http://localhost:3001').replace(/\/$/, '');
  }

  /**
   * Hands the reset link to whatever can deliver it.
   *
   * With no mail provider wired up the link goes to the log at warn level, which keeps the
   * flow usable in development and makes the missing integration impossible to overlook.
   */
  private async deliver(delivery: ResetDelivery) {
    this.logger.warn(
      { email: delivery.email, resetUrl: delivery.resetUrl, expiresAt: delivery.expiresAt },
      'password reset requested; no mail provider configured, link written to the log',
    );
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
