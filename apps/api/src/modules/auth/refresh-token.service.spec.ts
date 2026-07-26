import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../../../packages/shared/src';
import { RefreshTokenService } from './refresh-token.service';

type Row = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
};

/** In-memory stand-in for the RefreshToken table, enough to exercise rotation and reuse. */
function harness(overrides: Record<string, unknown> = {}) {
  const rows: Row[] = [];
  let sequence = 0;

  const prisma = {
    refreshToken: {
      create: vi.fn(async ({ data }: { data: Omit<Row, 'id'> }) => {
        const row: Row = { ...data, id: `rt_${++sequence}`, revokedAt: null, replacedById: null };
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
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        const matched = rows.filter(
          (row) =>
            (where.tokenHash === undefined || row.tokenHash === where.tokenHash) &&
            (where.userId === undefined || row.userId === where.userId) &&
            (where.revokedAt !== null || row.revokedAt === null),
        );
        matched.forEach((row) => Object.assign(row, data));
        return { count: matched.length };
      }),
      deleteMany: vi.fn(async ({ where }: { where: { expiresAt: { lt: Date } } }) => {
        const keep = rows.filter((row) => row.expiresAt >= where.expiresAt.lt);
        const removed = rows.length - keep.length;
        rows.splice(0, rows.length, ...keep);
        return { count: removed };
      }),
    },
  } as unknown as PrismaService;
  const config = { get: (key: string) => overrides[key] } as unknown as ConfigService;

  return { service: new RefreshTokenService(prisma, config), rows, prisma };
}

describe('RefreshTokenService.issue', () => {
  it('returns a high-entropy token and stores only its hash', async () => {
    const { service, rows } = harness();
    const issued = await service.issue('user_1', { ip: '10.0.0.1', userAgent: 'vitest' });

    expect(issued.token.length).toBeGreaterThanOrEqual(43);
    expect(rows[0].tokenHash).toBe(createHash('sha256').update(issued.token).digest('hex'));
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toContain(issued.token);
  });

  it('issues a different token every time', async () => {
    const { service } = harness();
    const [a, b] = await Promise.all([service.issue('user_1'), service.issue('user_1')]);

    expect(a.token).not.toBe(b.token);
  });

  it('honours the configured lifetime', () => {
    expect(harness({ REFRESH_TOKEN_TTL_DAYS: 7 }).service.ttlMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(harness().service.ttlMs).toBe(30 * 24 * 60 * 60 * 1000);
    expect(harness({ REFRESH_TOKEN_TTL_DAYS: -1 }).service.ttlMs).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe('RefreshTokenService.rotate', () => {
  let context: ReturnType<typeof harness>;

  beforeEach(() => {
    context = harness();
  });

  it('returns the owner and a new token, and retires the old one', async () => {
    const issued = await context.service.issue('user_1');
    const rotated = await context.service.rotate(issued.token);

    expect(rotated.userId).toBe('user_1');
    expect(rotated.token).not.toBe(issued.token);
    expect(context.rows[0].revokedAt).toBeInstanceOf(Date);
    expect(context.rows[0].replacedById).toBe(rotated.id);
  });

  it('rejects a token that was never issued', async () => {
    await expect(context.service.rotate('made-up')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const expired = harness({ REFRESH_TOKEN_TTL_DAYS: 30 });
    const issued = await expired.service.issue('user_1');
    expired.rows[0].expiresAt = new Date(Date.now() - 1000);

    await expect(expired.service.rotate(issued.token)).rejects.toThrow(/expired/i);
  });

  it('rejects a revoked token', async () => {
    const issued = await context.service.issue('user_1');
    await context.service.revoke(issued.token);

    await expect(context.service.rotate(issued.token)).rejects.toThrow(/already used/i);
  });

  it('revokes the whole family when a rotated token is replayed', async () => {
    const first = await context.service.issue('user_1');
    const second = await context.service.rotate(first.token);

    await expect(context.service.rotate(first.token)).rejects.toThrow(/already used/i);

    // The legitimate successor is revoked too: the family is assumed compromised.
    await expect(context.service.rotate(second.token)).rejects.toThrow(/already used/i);
  });
});

describe('RefreshTokenService revocation', () => {
  it('revokes a single token and reports whether anything changed', async () => {
    const { service } = harness();
    const issued = await service.issue('user_1');

    await expect(service.revoke(issued.token)).resolves.toBe(true);
    await expect(service.revoke(issued.token)).resolves.toBe(false);
    await expect(service.revoke('unknown')).resolves.toBe(false);
  });

  it('revokes every live session for one user', async () => {
    const { service, rows } = harness();
    await service.issue('user_1');
    await service.issue('user_1');
    await service.issue('user_2');

    await expect(service.revokeAllForUser('user_1')).resolves.toBe(2);
    expect(rows.filter((row) => row.revokedAt).map((row) => row.userId)).toEqual(['user_1', 'user_1']);
  });

  it('purges only rows that already expired', async () => {
    const { service, rows } = harness();
    await service.issue('user_1');
    await service.issue('user_1');
    rows[0].expiresAt = new Date(Date.now() - 1000);

    await expect(service.purgeExpired()).resolves.toBe(1);
    expect(rows).toHaveLength(1);
  });
});
