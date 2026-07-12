import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';
import { Model } from 'mongoose';
import { PrismaService, RawLog } from '../../../../../packages/shared/src';
import { serviceHealthStatus } from './dashboard-health';

type CountBySource = {
  _id: string;
  count: number;
};

type TopErrorService = {
  _id: { serviceId: string; serviceName: string };
  errorCount: number;
};

type ApiPerformanceRow = {
  _id: { path: string; method: string };
  count: number;
  avgDurationMs: number;
  maxDurationMs: number;
  errorCount: number;
};

type FrontendPageError = {
  _id: string;
  count: number;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(RawLog.name) private readonly rawLogModel: Model<RawLog>,
  ) {}

  async summary(ownerId: string, projectId: string) {
    await this.ensureProjectOwner(ownerId, projectId);
    const today = this.startOfToday();
    const todayFilter = { projectId, timestamp: { $gte: today } };
    const [
      totalServices,
      countsBySource,
      errorLogsToday,
      openIncidents,
      criticalIncidents,
      topErrorServices,
      slowestApiEndpoints,
      recentIncidents,
    ] = await Promise.all([
      this.prisma.service.count({ where: { projectId } }),
      this.rawLogModel.aggregate<CountBySource>([
        { $match: todayFilter },
        { $group: { _id: '$sourceType', count: { $sum: 1 } } },
      ]),
      this.rawLogModel.countDocuments({
        ...todayFilter,
        level: { $in: ['error', 'fatal'] },
      }),
      this.prisma.incident.count({
        where: { projectId, status: { not: IncidentStatus.RESOLVED } },
      }),
      this.prisma.incident.count({
        where: {
          projectId,
          status: { not: IncidentStatus.RESOLVED },
          severity: IncidentSeverity.CRITICAL,
        },
      }),
      this.topErrorServices(projectId, today, 5),
      this.apiPerformanceRows(projectId, today, 5),
      this.prisma.incident.findMany({
        where: { projectId },
        include: { service: true },
        orderBy: { lastSeenAt: 'desc' },
        take: 5,
      }),
    ]);
    const sourceCounts = Object.fromEntries(countsBySource.map((row) => [row._id, row.count]));

    return {
      totalServices,
      totalLogsToday: Object.values(sourceCounts).reduce((sum, count) => sum + count, 0),
      dockerLogsToday: sourceCounts.docker ?? 0,
      apiLogsToday: sourceCounts.api ?? 0,
      frontendLogsToday: sourceCounts.frontend ?? 0,
      errorLogsToday,
      openIncidents,
      criticalIncidents,
      topErrorServices,
      slowestApiEndpoints,
      recentIncidents: recentIncidents.map((incident) => ({
        id: incident.id,
        title: incident.title,
        serviceName: incident.service.name,
        severity: incident.severity,
        status: incident.status,
        lastSeenAt: incident.lastSeenAt,
      })),
    };
  }

  async servicesHealth(ownerId: string, projectId: string) {
    await this.ensureProjectOwner(ownerId, projectId);
    const [services, incidents] = await Promise.all([
      this.prisma.service.findMany({
        where: { projectId },
        orderBy: { lastSeenAt: 'desc' },
      }),
      this.prisma.incident.findMany({
        where: { projectId, status: { not: IncidentStatus.RESOLVED } },
        select: { serviceId: true, severity: true },
      }),
    ]);
    const incidentCounts = new Map<string, { open: number; critical: number }>();
    for (const incident of incidents) {
      const current = incidentCounts.get(incident.serviceId) ?? { open: 0, critical: 0 };
      current.open += 1;
      if (incident.severity === IncidentSeverity.CRITICAL) current.critical += 1;
      incidentCounts.set(incident.serviceId, current);
    }

    return services.map((service) => {
      const counts = incidentCounts.get(service.id) ?? { open: 0, critical: 0 };
      return {
        id: service.id,
        name: service.name,
        environment: service.environment,
        sourceTypes: service.sourceTypes,
        lastSeenAt: service.lastSeenAt,
        logCount: service.logCount,
        errorCount: service.errorCount,
        openIncidentCount: counts.open,
        criticalIncidentCount: counts.critical,
        status: serviceHealthStatus({
          lastSeenAt: service.lastSeenAt,
          openIncidentCount: counts.open,
          criticalIncidentCount: counts.critical,
          errorCount: service.errorCount,
        }),
      };
    });
  }

  async apiPerformance(ownerId: string, projectId: string) {
    await this.ensureProjectOwner(ownerId, projectId);
    return {
      items: await this.apiPerformanceRows(projectId, this.startOfToday(), 20),
    };
  }

  async frontendErrors(ownerId: string, projectId: string) {
    await this.ensureProjectOwner(ownerId, projectId);
    const today = this.startOfToday();
    const match = {
      projectId,
      sourceType: 'frontend',
      level: { $in: ['error', 'fatal'] },
      timestamp: { $gte: today },
    };
    const [totalToday, byPage, recent] = await Promise.all([
      this.rawLogModel.countDocuments(match),
      this.rawLogModel.aggregate<FrontendPageError>([
        { $match: match },
        { $group: { _id: { $ifNull: ['$frontend.pageUrl', 'unknown'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      this.rawLogModel.find(match).sort({ timestamp: -1 }).limit(20).lean(),
    ]);

    return {
      totalToday,
      byPage: byPage.map((row) => ({ pageUrl: row._id, count: row.count })),
      recent: recent.map((log) => ({
        id: String(log._id),
        serviceName: log.serviceName,
        level: log.level,
        message: log.message,
        pageUrl: log.frontend?.pageUrl,
        timestamp: log.timestamp,
      })),
    };
  }

  private async topErrorServices(projectId: string, today: Date, limit: number) {
    const rows = await this.rawLogModel.aggregate<TopErrorService>([
      {
        $match: {
          projectId,
          timestamp: { $gte: today },
          level: { $in: ['error', 'fatal'] },
        },
      },
      {
        $group: {
          _id: { serviceId: '$serviceId', serviceName: '$serviceName' },
          errorCount: { $sum: 1 },
        },
      },
      { $sort: { errorCount: -1 } },
      { $limit: limit },
    ]);

    return rows.map((row) => ({
      serviceId: row._id.serviceId,
      serviceName: row._id.serviceName,
      errorCount: row.errorCount,
    }));
  }

  private async apiPerformanceRows(projectId: string, today: Date, limit: number) {
    const rows = await this.rawLogModel.aggregate<ApiPerformanceRow>([
      {
        $match: {
          projectId,
          sourceType: 'api',
          timestamp: { $gte: today },
          'api.durationMs': { $type: 'number' },
        },
      },
      {
        $group: {
          _id: {
            path: { $ifNull: ['$api.path', 'unknown'] },
            method: { $ifNull: ['$api.method', 'unknown'] },
          },
          count: { $sum: 1 },
          avgDurationMs: { $avg: '$api.durationMs' },
          maxDurationMs: { $max: '$api.durationMs' },
          errorCount: {
            $sum: {
              $cond: [{ $gte: ['$api.statusCode', 500] }, 1, 0],
            },
          },
        },
      },
      { $sort: { avgDurationMs: -1 } },
      { $limit: limit },
    ]);

    return rows.map((row) => ({
      path: row._id.path,
      method: row._id.method,
      count: row.count,
      avgDurationMs: Math.round(row.avgDurationMs),
      maxDurationMs: row.maxDurationMs,
      errorCount: row.errorCount,
    }));
  }

  private async ensureProjectOwner(ownerId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}
