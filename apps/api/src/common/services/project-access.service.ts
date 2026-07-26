import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProjectRole } from '@prisma/client';
import { PrismaService } from '../../../../../packages/shared/src';

export const ROLE_RANK: Record<ProjectRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function roleAtLeast(role: ProjectRole, minimum: ProjectRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Prisma filter for "a project this user can see". Use instead of `{ ownerId }`. */
export function memberProjectFilter(userId: string): Prisma.ProjectWhereInput {
  return { members: { some: { userId } } };
}

/**
 * Single place that answers "may this user do this to this project".
 *
 * Access used to be `Project.ownerId === user.id`, which made a project impossible to
 * share. It now resolves through {@link ProjectMember} with a role floor per operation.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws unless the user holds at least `minimum` on the project. */
  async assert(userId: string, projectId: string, minimum: ProjectRole = ProjectRole.VIEWER) {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });

    // A project the user cannot see at all reads as missing rather than forbidden, so
    // membership cannot be probed by id.
    if (!membership) throw new NotFoundException('Project not found');
    if (!roleAtLeast(membership.role, minimum)) {
      throw new ForbiddenException(`This action requires the ${minimum.toLowerCase()} role`);
    }

    return membership.role;
  }

  /** Every project the user can read. Used when no explicit project is selected. */
  async accessibleProjectIds(userId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });

    return memberships.map((membership) => membership.projectId);
  }

  /**
   * Resolves the project scope of a query: the requested project when given (after an
   * access check), otherwise every project the user can read.
   */
  async scopeProjectIds(userId: string, projectId?: string, minimum: ProjectRole = ProjectRole.VIEWER) {
    if (projectId) {
      await this.assert(userId, projectId, minimum);
      return [projectId];
    }

    return this.accessibleProjectIds(userId);
  }
}
