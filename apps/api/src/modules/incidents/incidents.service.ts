import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IncidentEventType, IncidentStatus, Prisma } from '@prisma/client';
import { Model, Types } from 'mongoose';
import { ParsedLog, PrismaService, RawLog } from '../../../../../packages/shared/src';
import { pagination } from '../../common/utils/pagination';
import { FindIncidentsQueryDto } from './dto/find-incidents-query.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(RawLog.name) private readonly rawLogModel: Model<RawLog>,
    @InjectModel(ParsedLog.name) private readonly parsedLogModel: Model<ParsedLog>,
  ) {}

  async findAll(ownerId: string, query: FindIncidentsQueryDto) {
    const { page, limit, skip } = pagination(query.page, query.limit);
    const where = await this.whereFor(ownerId, query);
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

  async findOne(ownerId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: {
        id: incidentId,
        project: { ownerId },
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

  async updateStatus(ownerId: string, incidentId: string, status: IncidentStatus) {
    const incident = await this.findOne(ownerId, incidentId);
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

    return updated;
  }

  async logs(ownerId: string, incidentId: string, query: FindIncidentsQueryDto) {
    const incident = await this.findOne(ownerId, incidentId);
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
      this.rawLogModel.find({ _id: { $in: rawIds } }).sort({ timestamp: -1 }).lean(),
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

  private async whereFor(ownerId: string, query: FindIncidentsQueryDto): Promise<Prisma.IncidentWhereInput> {
    const projectIds = await this.projectIdsFor(ownerId, query.projectId);

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

  private async projectIdsFor(ownerId: string, projectId?: string) {
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, ownerId },
        select: { id: true },
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      return [projectId];
    }

    const projects = await this.prisma.project.findMany({
      where: { ownerId },
      select: { id: true },
    });

    return projects.map((project) => project.id);
  }
}
