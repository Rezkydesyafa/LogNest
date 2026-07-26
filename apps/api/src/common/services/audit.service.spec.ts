import { describe, expect, it, vi } from 'vitest';
import { PinoLogger, PrismaService } from '../../../../../packages/shared/src';
import { AuditService } from './audit.service';

function harness(createImpl?: () => Promise<unknown>) {
  const rows: Record<string, unknown>[] = [];
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    if (createImpl) return createImpl();
    rows.push(data);
    return data;
  });
  const prisma = {
    auditLog: {
      create,
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  } as unknown as PrismaService;
  const logger = { warn: vi.fn(), log: vi.fn(), error: vi.fn() } as unknown as PinoLogger;

  return { audit: new AuditService(prisma, logger), rows, prisma, logger, create };
}

const actor = { id: 'user_1', email: 'admin@example.com', ip: '203.0.113.1', userAgent: 'vitest' };

describe('AuditService.record', () => {
  it('writes the actor, action, target, and request origin', async () => {
    const { audit, rows } = harness();

    await audit.record({
      actor,
      action: 'api_key.revoked',
      targetType: 'api_key',
      targetId: 'key_1',
      projectId: 'project_1',
      metadata: { name: 'ci' },
    });

    expect(rows[0]).toMatchObject({
      userId: 'user_1',
      actorEmail: 'admin@example.com',
      action: 'api_key.revoked',
      targetType: 'api_key',
      targetId: 'key_1',
      projectId: 'project_1',
      ip: '203.0.113.1',
      userAgent: 'vitest',
      metadata: { name: 'ci' },
    });
  });

  it('keeps the actor email so the trail survives account deletion', async () => {
    const { audit, rows } = harness();

    await audit.record({ actor, action: 'project.deleted', targetType: 'project' });

    expect(rows[0].actorEmail).toBe('admin@example.com');
  });

  it('truncates an oversized user agent instead of failing the insert', async () => {
    const { audit, rows } = harness();

    await audit.record({
      actor: { ...actor, userAgent: 'x'.repeat(500) },
      action: 'project.created',
      targetType: 'project',
    });

    expect(String(rows[0].userAgent)).toHaveLength(255);
  });

  it('accepts an account-level action with no project', async () => {
    const { audit, rows } = harness();

    await audit.record({ actor, action: 'project.created', targetType: 'project' });

    expect(rows[0].projectId).toBeUndefined();
  });

  it('never throws when the write fails, and logs instead', async () => {
    const { audit, logger } = harness(async () => {
      throw new Error('db down');
    });

    await expect(
      audit.record({ actor, action: 'project.created', targetType: 'project' }),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});

describe('AuditService.findForProject', () => {
  it('returns the newest entries first with a default page size', async () => {
    const { audit, prisma } = harness();

    await audit.findForProject('project_1');

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project_1' },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 50,
    });
  });

  it('passes pagination through', async () => {
    const { audit, prisma } = harness();

    await audit.findForProject('project_1', { skip: 40, take: 20 });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
  });
});
