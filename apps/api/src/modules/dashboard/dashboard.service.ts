import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';
import { Model, PipelineStage } from 'mongoose';
import { PrismaService, RawLog } from '../../../../../packages/shared/src';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { serviceHealth } from './dashboard-health';
import { DashboardRange, dashboardWindow, percentChange } from './dashboard-range';

type Window = ReturnType<typeof dashboardWindow>;
type PeriodSourceCount = {
  _id: { period: 'current' | 'previous'; sourceType: string };
  count: number;
  errorCount: number;
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
  percentiles: number[];
  errorCount: number;
};
type FrontendPageError = { _id: string; count: number };
type ServicePeriodStats = { _id: string; logCount: number; errorCount: number };
type TimelineRow = {
  _id: Date;
  logCount: number;
  errorCount: number;
  avgApiDurationMs?: number;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    @InjectModel(RawLog.name) private readonly rawLogModel: Model<RawLog>,
  ) {}

  async summary(userId: string, projectId: string, range: DashboardRange = '24h') {
    await this.access.assert(userId, projectId);
    const window = dashboardWindow(range);
    const [
      totalServices,
      periodRows,
      openIncidents,
      criticalIncidents,
      topErrorServices,
      slowestApiEndpoints,
      recentIncidents,
      currentIncidentCount,
      previousIncidentCount,
      timeSeries,
    ] = await Promise.all([
      this.prisma.service.count({ where: { projectId } }),
      this.periodSourceCounts(projectId, window),
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
      this.topErrorServices(projectId, window, 5),
      this.apiPerformanceRows(projectId, window, 5),
      this.prisma.incident.findMany({
        where: { projectId },
        include: { service: true },
        orderBy: { lastSeenAt: 'desc' },
        take: 5,
      }),
      this.prisma.incident.count({
        where: { projectId, createdAt: { gte: window.from, lt: window.to } },
      }),
      this.prisma.incident.count({
        where: { projectId, createdAt: { gte: window.previousFrom, lt: window.from } },
      }),
      this.timeSeries(projectId, window),
    ]);
    const currentRows = periodRows.filter((row) => row._id.period === 'current');
    const previousRows = periodRows.filter((row) => row._id.period === 'previous');
    const sourceCounts = this.sourceCounts(currentRows);
    const currentTotal = sum(currentRows, 'count');
    const currentErrors = sum(currentRows, 'errorCount');
    const previousTotal = sum(previousRows, 'count');
    const previousErrors = sum(previousRows, 'errorCount');

    return {
      range: rangeResponse(window),
      totalServices,
      totalLogs: currentTotal,
      dockerLogs: sourceCounts.docker,
      apiLogs: sourceCounts.api,
      frontendLogs: sourceCounts.frontend,
      workerLogs: sourceCounts.worker,
      manualLogs: sourceCounts.manual,
      errorLogs: currentErrors,
      openIncidents,
      criticalIncidents,
      sourceCounts,
      trends: {
        totalLogs: percentChange(currentTotal, previousTotal),
        errorLogs: percentChange(currentErrors, previousErrors),
        incidents: percentChange(currentIncidentCount, previousIncidentCount),
      },
      timeSeries,
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

  async servicesHealth(userId: string, projectId: string, range: DashboardRange = '24h') {
    await this.access.assert(userId, projectId);
    return this.serviceHealthRows(projectId, dashboardWindow(range));
  }

  async serviceDetail(userId: string, projectId: string, serviceId: string, range: DashboardRange = '24h') {
    await this.access.assert(userId, projectId);
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, projectId } });
    if (!service) throw new NotFoundException('Service not found');

    const window = dashboardWindow(range);
    const [healthRows, timeSeries, sourceRows, apiPerformance, recentIncidents, recentLogs] =
      await Promise.all([
        this.serviceHealthRows(projectId, window, serviceId),
        this.timeSeries(projectId, window, serviceId),
        this.rawLogModel.aggregate<{ _id: string; count: number }>([
          {
            $match: {
              projectId,
              serviceId,
              timestamp: { $gte: window.from, $lt: window.to },
            },
          },
          { $group: { _id: '$sourceType', count: { $sum: 1 } } },
        ]),
        this.apiPerformanceRows(projectId, window, 10, serviceId),
        this.prisma.incident.findMany({
          where: { projectId, serviceId },
          include: { service: true },
          orderBy: { lastSeenAt: 'desc' },
          take: 5,
        }),
        this.rawLogModel
          .find({
            projectId,
            serviceId,
            timestamp: { $gte: window.from, $lt: window.to },
          })
          .sort({ timestamp: -1 })
          .limit(10)
          .lean(),
      ]);

    return {
      range: rangeResponse(window),
      service: healthRows[0],
      sourceCounts: Object.fromEntries(sourceRows.map((row) => [row._id, row.count])),
      timeSeries,
      apiPerformance,
      recentIncidents,
      recentLogs: recentLogs.map((log) => ({ ...log, id: String(log._id) })),
    };
  }

  async apiPerformance(userId: string, projectId: string, range: DashboardRange = '24h') {
    await this.access.assert(userId, projectId);
    const window = dashboardWindow(range);
    return { range: rangeResponse(window), items: await this.apiPerformanceRows(projectId, window, 20) };
  }

  async frontendErrors(userId: string, projectId: string, range: DashboardRange = '24h') {
    await this.access.assert(userId, projectId);
    const window = dashboardWindow(range);
    const match = {
      projectId,
      sourceType: 'frontend',
      level: { $in: ['error', 'fatal'] },
      timestamp: { $gte: window.from, $lt: window.to },
    };
    const [total, byPage, recent] = await Promise.all([
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
      range: rangeResponse(window),
      total,
      totalToday: total,
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

  private async serviceHealthRows(projectId: string, window: Window, serviceId?: string) {
    const serviceWhere = { projectId, ...(serviceId ? { id: serviceId } : {}) };
    const logMatch = {
      projectId,
      ...(serviceId ? { serviceId } : {}),
      timestamp: { $gte: window.from, $lt: window.to },
    };
    const [services, incidents, stats] = await Promise.all([
      this.prisma.service.findMany({ where: serviceWhere, orderBy: { lastSeenAt: 'desc' } }),
      this.prisma.incident.findMany({
        where: {
          projectId,
          ...(serviceId ? { serviceId } : {}),
          status: { not: IncidentStatus.RESOLVED },
        },
        select: { serviceId: true, severity: true },
      }),
      this.rawLogModel.aggregate<ServicePeriodStats>([
        { $match: logMatch },
        {
          $group: {
            _id: '$serviceId',
            logCount: { $sum: 1 },
            errorCount: {
              $sum: { $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0] },
            },
          },
        },
      ]),
    ]);
    const incidentCounts = new Map<string, { open: number; critical: number }>();
    for (const incident of incidents) {
      const current = incidentCounts.get(incident.serviceId) ?? { open: 0, critical: 0 };
      current.open += 1;
      if (incident.severity === IncidentSeverity.CRITICAL) current.critical += 1;
      incidentCounts.set(incident.serviceId, current);
    }
    const statsByService = new Map(stats.map((row) => [row._id, row]));

    return services.map((service) => {
      const counts = incidentCounts.get(service.id) ?? { open: 0, critical: 0 };
      const period = statsByService.get(service.id) ?? { logCount: 0, errorCount: 0 };
      const health = serviceHealth({
        lastSeenAt: service.lastSeenAt,
        openIncidentCount: counts.open,
        criticalIncidentCount: counts.critical,
        logCount: period.logCount,
        errorCount: period.errorCount,
      });

      return {
        ...service,
        periodLogCount: period.logCount,
        periodErrorCount: period.errorCount,
        openIncidentCount: counts.open,
        criticalIncidentCount: counts.critical,
        ...health,
      };
    });
  }

  private async periodSourceCounts(projectId: string, window: Window) {
    return this.rawLogModel.aggregate<PeriodSourceCount>([
      {
        $match: {
          projectId,
          timestamp: { $gte: window.previousFrom, $lt: window.to },
        },
      },
      {
        $group: {
          _id: {
            period: { $cond: [{ $gte: ['$timestamp', window.from] }, 'current', 'previous'] },
            sourceType: '$sourceType',
          },
          count: { $sum: 1 },
          errorCount: {
            $sum: { $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0] },
          },
        },
      },
    ]);
  }

  private sourceCounts(rows: PeriodSourceCount[]) {
    const counts: Record<string, number> = {
      docker: 0,
      api: 0,
      frontend: 0,
      worker: 0,
      manual: 0,
    };
    for (const row of rows) counts[row._id.sourceType] = row.count;
    return counts;
  }

  private async timeSeries(projectId: string, window: Window, serviceId?: string) {
    const [logs, incidents] = await Promise.all([
      this.rawLogModel.aggregate<TimelineRow>([
        {
          $match: {
            projectId,
            ...(serviceId ? { serviceId } : {}),
            timestamp: { $gte: window.from, $lt: window.to },
          },
        },
        {
          $group: {
            _id: {
              $dateTrunc: {
                date: '$timestamp',
                unit: 'minute',
                binSize: window.bucketMinutes,
              },
            },
            logCount: { $sum: 1 },
            errorCount: {
              $sum: { $cond: [{ $in: ['$level', ['error', 'fatal']] }, 1, 0] },
            },
            avgApiDurationMs: {
              $avg: {
                $cond: [
                  { $and: [{ $eq: ['$sourceType', 'api'] }, { $isNumber: '$api.durationMs' }] },
                  '$api.durationMs',
                  null,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.prisma.incident.findMany({
        where: {
          projectId,
          ...(serviceId ? { serviceId } : {}),
          createdAt: { gte: window.from, lt: window.to },
        },
        select: { createdAt: true },
      }),
    ]);
    const bucketMs = window.bucketMinutes * 60_000;
    const byBucket = new Map(logs.map((row) => [new Date(row._id).getTime(), row]));
    const incidentsByBucket = new Map<number, number>();
    for (const incident of incidents) {
      const bucket = Math.floor(incident.createdAt.getTime() / bucketMs) * bucketMs;
      incidentsByBucket.set(bucket, (incidentsByBucket.get(bucket) ?? 0) + 1);
    }
    const result = [];
    const firstBucket = Math.floor(window.from.getTime() / bucketMs) * bucketMs;
    for (let timestamp = firstBucket; timestamp < window.to.getTime(); timestamp += bucketMs) {
      const row = byBucket.get(timestamp);
      const logCount = row?.logCount ?? 0;
      const errorCount = row?.errorCount ?? 0;
      result.push({
        timestamp: new Date(timestamp).toISOString(),
        logCount,
        logsPerMinute: Math.round((logCount / window.bucketMinutes) * 100) / 100,
        errorCount,
        errorRate: logCount ? Math.round((errorCount / logCount) * 1000) / 10 : 0,
        incidentCount: incidentsByBucket.get(timestamp) ?? 0,
        avgApiDurationMs: row?.avgApiDurationMs === undefined ? null : Math.round(row.avgApiDurationMs),
      });
    }
    return result;
  }

  private async topErrorServices(projectId: string, window: Window, limit: number) {
    const rows = await this.rawLogModel.aggregate<TopErrorService>([
      {
        $match: {
          projectId,
          timestamp: { $gte: window.from, $lt: window.to },
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

  private async apiPerformanceRows(projectId: string, window: Window, limit: number, serviceId?: string) {
    // MongoDB 7 supports $percentile; Mongoose's pipeline type has not caught up yet.
    const pipeline = [
      {
        $match: {
          projectId,
          ...(serviceId ? { serviceId } : {}),
          sourceType: 'api',
          timestamp: { $gte: window.from, $lt: window.to },
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
          percentiles: {
            $percentile: {
              input: '$api.durationMs',
              p: [0.95, 0.99],
              method: 'approximate',
            },
          },
          errorCount: {
            $sum: { $cond: [{ $gte: ['$api.statusCode', 500] }, 1, 0] },
          },
        },
      },
      { $sort: { avgDurationMs: -1 } },
      { $limit: limit },
    ] as unknown as PipelineStage[];
    const rows = await this.rawLogModel.aggregate<ApiPerformanceRow>(pipeline);

    return rows.map((row) => ({
      path: row._id.path,
      method: row._id.method,
      count: row.count,
      avgDurationMs: Math.round(row.avgDurationMs),
      p95DurationMs: Math.round(row.percentiles?.[0] ?? row.avgDurationMs),
      p99DurationMs: Math.round(row.percentiles?.[1] ?? row.avgDurationMs),
      maxDurationMs: row.maxDurationMs,
      errorCount: row.errorCount,
    }));
  }
}

function sum(rows: PeriodSourceCount[], key: 'count' | 'errorCount') {
  return rows.reduce((total, row) => total + row[key], 0);
}

function rangeResponse(window: Window) {
  return {
    key: window.range,
    from: window.from,
    to: window.to,
    bucketMinutes: window.bucketMinutes,
  };
}
