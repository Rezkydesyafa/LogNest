import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../../../packages/shared/src';
import { memberProjectFilter, ProjectAccessService, ROLE_RANK, roleAtLeast } from './project-access.service';

function serviceWith(role?: ProjectRole, projectIds: string[] = []) {
  const prisma = {
    projectMember: {
      findUnique: vi.fn().mockResolvedValue(role ? { role } : null),
      findMany: vi.fn().mockResolvedValue(projectIds.map((projectId) => ({ projectId }))),
    },
  } as unknown as PrismaService;

  return { access: new ProjectAccessService(prisma), prisma };
}

describe('roleAtLeast', () => {
  it('ranks roles from viewer up to owner', () => {
    expect(ROLE_RANK.VIEWER).toBeLessThan(ROLE_RANK.MEMBER);
    expect(ROLE_RANK.MEMBER).toBeLessThan(ROLE_RANK.ADMIN);
    expect(ROLE_RANK.ADMIN).toBeLessThan(ROLE_RANK.OWNER);
  });

  it('treats a higher role as satisfying a lower requirement', () => {
    expect(roleAtLeast(ProjectRole.OWNER, ProjectRole.VIEWER)).toBe(true);
    expect(roleAtLeast(ProjectRole.ADMIN, ProjectRole.ADMIN)).toBe(true);
    expect(roleAtLeast(ProjectRole.VIEWER, ProjectRole.MEMBER)).toBe(false);
  });
});

describe('memberProjectFilter', () => {
  it('scopes to projects the user is a member of', () => {
    expect(memberProjectFilter('user_1')).toEqual({ members: { some: { userId: 'user_1' } } });
  });
});

describe('ProjectAccessService.assert', () => {
  it('returns the role when it clears the floor', async () => {
    const { access } = serviceWith(ProjectRole.ADMIN);

    await expect(access.assert('user_1', 'project_1', ProjectRole.MEMBER)).resolves.toBe(ProjectRole.ADMIN);
  });

  it('defaults to requiring only viewer', async () => {
    const { access } = serviceWith(ProjectRole.VIEWER);

    await expect(access.assert('user_1', 'project_1')).resolves.toBe(ProjectRole.VIEWER);
  });

  it('reports a project the user cannot see as missing, not forbidden', async () => {
    const { access } = serviceWith(undefined);

    await expect(access.assert('user_1', 'project_1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids an action above the caller role', async () => {
    const { access } = serviceWith(ProjectRole.VIEWER);

    await expect(access.assert('user_1', 'project_1', ProjectRole.ADMIN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('looks the membership up by the composite key', async () => {
    const { access, prisma } = serviceWith(ProjectRole.OWNER);

    await access.assert('user_1', 'project_1');

    expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: 'project_1', userId: 'user_1' } },
      select: { role: true },
    });
  });
});

describe('ProjectAccessService.scopeProjectIds', () => {
  it('narrows to the requested project after an access check', async () => {
    const { access } = serviceWith(ProjectRole.MEMBER, ['project_1', 'project_2']);

    await expect(access.scopeProjectIds('user_1', 'project_1')).resolves.toEqual(['project_1']);
  });

  it('falls back to every accessible project', async () => {
    const { access } = serviceWith(ProjectRole.MEMBER, ['project_1', 'project_2']);

    await expect(access.scopeProjectIds('user_1')).resolves.toEqual(['project_1', 'project_2']);
  });

  it('returns nothing for a user with no memberships', async () => {
    const { access } = serviceWith(undefined, []);

    await expect(access.scopeProjectIds('user_1')).resolves.toEqual([]);
  });

  it('propagates the role floor to the explicit project', async () => {
    const { access } = serviceWith(ProjectRole.VIEWER);

    await expect(access.scopeProjectIds('user_1', 'project_1', ProjectRole.ADMIN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
