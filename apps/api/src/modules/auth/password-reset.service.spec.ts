import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { PinoLogger, PrismaService } from '../../../../../packages/shared/src';
import { HashingService } from '../../common/services/hashing.service';
import { PasswordResetService } from './password-reset.service';
import { RefreshTokenService } from './refresh-token.service';

type Row = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

function harness(options: { user?: { id: string; email: string }; settings?: Record<string, unknown> } = {}) {
  const rows: Row[] = [];
  const users = new Map<string, string>();
  let sequence = 0;

  const prisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) =>
        options.user && options.user.email === where.email ? options.user : null,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { passwordHash: string } }) => {
        users.set(where.id, data.passwordHash);
        return { id: where.id };
      }),
    },
    passwordResetToken: {
      create: vi.fn(async ({ data }: { data: Omit<Row, 'id' | 'usedAt'> }) => {
        const row: Row = { ...data, id: `prt_${++sequence}`, usedAt: null };
        rows.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
        rows.find((row) => row.tokenHash === where.tokenHash),
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((entry) => entry.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string }; data: Partial<Row> }) => {
        const matched = rows.filter((row) => row.userId === where.userId && row.usedAt === null);
        matched.forEach((row) => Object.assign(row, data));
        return { count: matched.length };
      }),
    },
    // The reset runs user update and token consumption together.
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  } as unknown as PrismaService;

  const refreshTokens = { revokeAllForUser: vi.fn().mockResolvedValue(2) } as unknown as RefreshTokenService;
  const config = { get: (key: string) => options.settings?.[key] } as unknown as ConfigService;
  const logger = { warn: vi.fn(), log: vi.fn(), error: vi.fn() } as unknown as PinoLogger;

  return {
    service: new PasswordResetService(prisma, new HashingService(), refreshTokens, config, logger),
    rows,
    users,
    refreshTokens,
    logger,
    prisma,
  };
}

const user = { id: 'user_1', email: 'user@example.com' };
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Recovers the raw token from the delivery log, the way a user would from their inbox. */
function tokenFromLog(logger: PinoLogger) {
  const call = (logger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as { resetUrl: string };
  return decodeURIComponent(new URL(call.resetUrl).searchParams.get('token')!);
}

describe('PasswordResetService.request', () => {
  it('issues a token for a known email', async () => {
    const { service, rows } = harness({ user });

    await expect(service.request(user.email)).resolves.toEqual({ requested: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe('user_1');
  });

  it('answers identically for an unknown email, so accounts cannot be probed', async () => {
    const { service, rows } = harness({ user });

    await expect(service.request('nobody@example.com')).resolves.toEqual({ requested: true });
    expect(rows).toHaveLength(0);
  });

  it('matches the email case-insensitively', async () => {
    const { service, rows } = harness({ user });

    await service.request('USER@EXAMPLE.COM');

    expect(rows).toHaveLength(1);
  });

  it('stores only the hash, never the token itself', async () => {
    const { service, rows, logger } = harness({ user });

    await service.request(user.email);

    expect(rows[0].tokenHash).toBe(hash(tokenFromLog(logger)));
    expect(rows[0].tokenHash).not.toBe(tokenFromLog(logger));
  });

  it('voids an earlier outstanding request when a new one is made', async () => {
    const { service, rows } = harness({ user });

    await service.request(user.email);
    await service.request(user.email);

    expect(rows[0].usedAt).toBeInstanceOf(Date);
    expect(rows[1].usedAt).toBeNull();
  });

  it('honours the configured lifetime', () => {
    expect(harness({ settings: { PASSWORD_RESET_TTL_MINUTES: 10 } }).service.ttlMs).toBe(600_000);
    expect(harness().service.ttlMs).toBe(1_800_000);
    expect(harness({ settings: { PASSWORD_RESET_TTL_MINUTES: -1 } }).service.ttlMs).toBe(1_800_000);
  });

  it('points the link at the dashboard', async () => {
    const { service, logger } = harness({
      user,
      settings: { DASHBOARD_URL: 'https://logmind.example.com/' },
    });

    await service.request(user.email);
    const call = (logger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as { resetUrl: string };

    expect(call.resetUrl.startsWith('https://logmind.example.com/reset-password?token=')).toBe(true);
  });
});

describe('PasswordResetService.reset', () => {
  it('sets the new password and consumes the token', async () => {
    const { service, rows, users, logger } = harness({ user });
    await service.request(user.email);

    await expect(service.reset(tokenFromLog(logger), 'a-new-password')).resolves.toMatchObject({
      reset: true,
    });
    expect(rows[0].usedAt).toBeInstanceOf(Date);
    expect(users.get('user_1')?.startsWith('scrypt$v1$')).toBe(true);
  });

  it('ends every existing session, since a reset implies a compromise', async () => {
    const { service, refreshTokens, logger } = harness({ user });
    await service.request(user.email);

    const result = await service.reset(tokenFromLog(logger), 'a-new-password');

    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user_1');
    expect(result.revokedSessions).toBe(2);
  });

  it('refuses a token that was already used', async () => {
    const { service, logger } = harness({ user });
    await service.request(user.email);
    const token = tokenFromLog(logger);
    await service.reset(token, 'a-new-password');

    await expect(service.reset(token, 'another-password')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an expired token', async () => {
    const { service, rows, logger } = harness({ user });
    await service.request(user.email);
    rows[0].expiresAt = new Date(Date.now() - 1000);

    await expect(service.reset(tokenFromLog(logger), 'a-new-password')).rejects.toThrow(/expired/i);
  });

  it('refuses a token that was never issued', async () => {
    const { service } = harness({ user });

    await expect(service.reset('made-up', 'a-new-password')).rejects.toBeInstanceOf(BadRequestException);
  });
});
