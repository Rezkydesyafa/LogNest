import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';
import { PrismaService } from '../../../../../packages/shared/src';
import { memberProjectFilter, ProjectAccessService } from '../../common/services/project-access.service';
import { AuditActor, AuditService } from '../../common/services/audit.service';
import { UsersService } from '../users/users.service';
import { AddProjectMemberDto, UpdateProjectMemberDto } from './dto/project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuditActor, dto: CreateProjectDto) {
    const userId = actor.id!;

    try {
      // The creator is seeded as OWNER in the same transaction, so a project is never
      // left without anyone able to administer it.
      const project = await this.prisma.project.create({
        data: {
          ownerId: userId,
          name: dto.name,
          description: dto.description,
          timezone: dto.timezone ?? 'UTC',
          members: { create: { userId, role: ProjectRole.OWNER } },
        },
      });

      await this.audit.record({
        actor,
        action: 'project.created',
        targetType: 'project',
        targetId: project.id,
        projectId: project.id,
        metadata: { name: project.name },
      });

      return project;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Project name already exists');
      }
      throw error;
    }
  }

  /**
   * Projects the user can see, each carrying the role they hold in it.
   *
   * The frontend needs the role to decide which actions to offer; without it every user
   * sees buttons that only fail with a 403 once clicked.
   */
  async findAll(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: memberProjectFilter(userId),
      include: { members: { where: { userId }, select: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map(({ members, ...project }) => ({
      ...project,
      role: members[0]?.role ?? ProjectRole.VIEWER,
    }));
  }

  async findOne(userId: string, projectId: string) {
    const role = await this.access.assert(userId, projectId);
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return { ...project, role };
  }

  async update(actor: AuditActor, projectId: string, dto: UpdateProjectDto) {
    await this.access.assert(actor.id!, projectId, ProjectRole.ADMIN);

    try {
      const project = await this.prisma.project.update({
        where: { id: projectId },
        data: dto,
      });

      await this.audit.record({
        actor,
        action: 'project.updated',
        targetType: 'project',
        targetId: projectId,
        projectId,
        metadata: { ...dto },
      });

      return project;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Project name already exists');
      }
      throw error;
    }
  }

  async remove(actor: AuditActor, projectId: string) {
    await this.access.assert(actor.id!, projectId, ProjectRole.OWNER);
    // Recorded before the delete: the cascade would take the audit rows with it.
    await this.audit.record({
      actor,
      action: 'project.deleted',
      targetType: 'project',
      targetId: projectId,
    });
    await this.prisma.project.delete({ where: { id: projectId } });

    return { deleted: true };
  }

  async findMembers(userId: string, projectId: string) {
    await this.access.assert(userId, projectId);

    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(actor: AuditActor, projectId: string, dto: AddProjectMemberDto) {
    await this.access.assert(actor.id!, projectId, ProjectRole.ADMIN);

    const invited = await this.usersService.findByEmail(dto.email);
    if (!invited) {
      throw new NotFoundException('No user is registered with that email');
    }

    try {
      const member = await this.prisma.projectMember.create({
        data: { projectId, userId: invited.id, role: dto.role ?? ProjectRole.VIEWER },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      await this.audit.record({
        actor,
        action: 'project.member.added',
        targetType: 'project_member',
        targetId: member.id,
        projectId,
        metadata: { email: invited.email, role: member.role },
      });

      return member;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('That user is already a member of this project');
      }
      throw error;
    }
  }

  async updateMember(actor: AuditActor, memberId: string, dto: UpdateProjectMemberDto) {
    const member = await this.memberOrThrow(memberId);
    await this.access.assert(actor.id!, member.projectId, ProjectRole.ADMIN);
    await this.assertNotLastOwner(member, dto.role);

    const updated = await this.prisma.projectMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    await this.audit.record({
      actor,
      action: 'project.member.role_changed',
      targetType: 'project_member',
      targetId: memberId,
      projectId: member.projectId,
      metadata: { email: updated.user.email, from: member.role, to: updated.role },
    });

    return updated;
  }

  async removeMember(actor: AuditActor, memberId: string) {
    const member = await this.memberOrThrow(memberId);
    await this.access.assert(actor.id!, member.projectId, ProjectRole.ADMIN);
    await this.assertNotLastOwner(member);
    await this.prisma.projectMember.delete({ where: { id: memberId } });

    await this.audit.record({
      actor,
      action: 'project.member.removed',
      targetType: 'project_member',
      targetId: memberId,
      projectId: member.projectId,
      metadata: { userId: member.userId, role: member.role },
    });

    return { removed: true };
  }

  private async memberOrThrow(memberId: string) {
    const member = await this.prisma.projectMember.findUnique({ where: { id: memberId } });

    if (!member) {
      throw new NotFoundException('Project member not found');
    }

    return member;
  }

  /** A project must always keep at least one owner, or nobody could administer it again. */
  private async assertNotLastOwner(
    member: { id: string; projectId: string; role: ProjectRole },
    nextRole?: ProjectRole,
  ) {
    if (member.role !== ProjectRole.OWNER || nextRole === ProjectRole.OWNER) return;

    const owners = await this.prisma.projectMember.count({
      where: { projectId: member.projectId, role: ProjectRole.OWNER },
    });

    if (owners <= 1) {
      throw new BadRequestException('A project must keep at least one owner');
    }
  }

  private isUniqueError(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
