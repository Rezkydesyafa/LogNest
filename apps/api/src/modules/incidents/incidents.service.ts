import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IncidentEventType, IncidentStatus, Prisma, ProjectRole } from '@prisma/client';
import { Model, Types } from 'mongoose';
import { ParsedLog, PrismaService, RawLog } from '../../../../../packages/shared/src';
import { AuditActor, AuditService } from '../../common/services/audit.service';
import { memberProjectFilter, ProjectAccessService } from '../../common/services/project-access.service';
import { pagination } from '../../common/utils/pagination';
import { FindIncidentsQueryDto } from './dto/find-incidents-query.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    @InjectModel(RawLog.name) private readonly rawLogModel: Model<RawLog>,
    @InjectModel(ParsedLog.name) private readonly parsedLogModel: Model<ParsedLog>,
  ) {}

  async findAll(userId: string, query: FindIncidentsQueryDto) {
    const { page, limit, skip } = pagination(query.page, query.limit);
    const where = await this.whereFor(userId, query);
    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        include: {
          service: true,
          events: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
        orderBy: { lastSeenAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async findOne(userId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: {
        id: incidentId,
        project: memberProjectFilter(userId),
      },
      include: {
        service: true,
        events: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return incident;
  }

  async updateStatus(actor: AuditActor, incidentId: string, status: IncidentStatus) {
    const incident = await this.findOne(actor.id!, incidentId);
    // Changing incident state is an operator action, not a read.
    await this.access.assert(actor.id!, incident.projectId, ProjectRole.MEMBER);
    const updated = await this.prisma.incident.update({
      where: { id: incident.id },
      data: {
        status,
        resolvedAt: status === IncidentStatus.RESOLVED ? new Date() : null,
      },
    });

    await this.prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: IncidentEventType.STATUS_CHANGED,
        message: `Status changed from ${incident.status.toLowerCase()} to ${status.toLowerCase()}`,
      },
    });
    await this.audit.record({
      actor,
      action: 'incident.status_changed',
      targetType: 'incident',
      targetId: incident.id,
      projectId: incident.projectId,
      metadata: { from: incident.status, to: status },
    });

    return updated;
  }

  async logs(userId: string, incidentId: string, query: FindIncidentsQueryDto) {
    const incident = await this.findOne(userId, incidentId);
    const { page, limit, skip } = pagination(query.page, query.limit);
    const parsed = await this.parsedLogModel
      .find({
        projectId: incident.projectId,
        serviceId: incident.serviceId,
        fingerprint: incident.fingerprint,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const rawIds = parsed
      .map((log) => String(log.rawLogId))
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    const [items, total] = await Promise.all([
      this.rawLogModel
        .find({ _id: { $in: rawIds } })
        .sort({ timestamp: -1 })
        .lean(),
      this.parsedLogModel.countDocuments({
        projectId: incident.projectId,
        serviceId: incident.serviceId,
        fingerprint: incident.fingerprint,
      }),
    ]);

    return {
      items: items.map((log) => ({ ...log, id: String(log._id) })),
      page,
      limit,
      total,
    };
  }

  private async whereFor(userId: string, query: FindIncidentsQueryDto): Promise<Prisma.IncidentWhereInput> {
    const projectIds = await this.access.scopeProjectIds(userId, query.projectId);

    if (!projectIds.length) {
      return { projectId: '__none__' };
    }

    return {
      projectId: projectIds.length === 1 ? projectIds[0] : { in: projectIds },
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
    };
  }
}
