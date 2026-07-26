import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PinoLogger, PrismaService } from '../../../../../packages/shared/src';

/** Stable, greppable action names. Kept as a union so a typo fails the build. */
export type AuditAction =
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.member.added'
  | 'project.member.role_changed'
  | 'project.member.removed'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'alert_channel.created'
  | 'alert_channel.updated'
  | 'alert_channel.deleted'
  | 'alert_channel.tested'
  | 'alert_rule.created'
  | 'alert_rule.updated'
  | 'alert_rule.deleted'
  | 'incident.status_changed'
  | 'incident.analysis_requested';

export type AuditActor = {
  id?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
};

export type AuditEntry = {
  actor: AuditActor;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  projectId?: string;
  metadata?: Prisma.InputJsonObject;
};

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Appends one entry to the audit trail.
   *
   * Never throws: an audit write failing must not roll back or block the action the user
   * actually asked for. A failure is logged instead so it is still visible.
   */
  async record(entry: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: {
          projectId: entry.projectId,
          userId: entry.actor.id,
          // Denormalised so the trail still names the actor after the account is deleted.
          actorEmail: entry.actor.email,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          metadata: entry.metadata,
          ip: entry.actor.ip,
          userAgent: entry.actor.userAgent?.slice(0, 255),
        },
      });
    } catch (error) {
      this.logger.warn({ action: entry.action, err: String(error) }, 'audit log write failed');
    }
  }

  async findForProject(projectId: string, options: { skip?: number; take?: number } = {}) {
    return this.prisma.auditLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      skip: options.skip ?? 0,
      take: options.take ?? 50,
    });
  }

  async countForProject(projectId: string) {
    return this.prisma.auditLog.count({ where: { projectId } });
  }
}
