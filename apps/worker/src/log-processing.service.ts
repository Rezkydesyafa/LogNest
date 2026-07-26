import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { AlertTrigger, Incident } from '@prisma/client';
import { Collection, Connection, Types } from 'mongoose';
import { AlertDispatcherService } from './alerts/alert-dispatcher.service';
import { IncidentAnalysisProducer } from './analysis/incident-analysis.producer';
import {
  alertTriggerFor,
  createdIncidentEvent,
  IncidentDetection,
  planIncidentUpdate,
} from './incident-plan';
import {
  generateFingerprint,
  MetricsService,
  PARSED_LOG_COLLECTION,
  PinoLogger,
  PrismaService,
  ProjectEventsService,
  RAW_LOG_COLLECTION,
  RawLog,
  RedisService,
  triggeredIncidentSeverity,
} from '../../../packages/shared/src';

type LogProcessingJob = {
  rawLogId: string;
  projectId: string;
  serviceId: string;
  sourceType: string;
  level: string;
};

@Injectable()
export class LogProcessingService implements OnModuleInit {
  private readonly tenMinutesMs = 10 * 60 * 1000;
  private readonly fiveMinutesMs = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly alerts: AlertDispatcherService,
    private readonly analysis: IncidentAnalysisProducer,
    private readonly events: ProjectEventsService,
    private readonly metrics: MetricsService,
    private readonly logger: PinoLogger,
    @InjectConnection() private readonly mongo: Connection,
  ) {}

  async onModuleInit() {
    await this.parsedLogs().createIndex({ rawLogId: 1 }, { unique: true });
    await this.parsedLogs().createIndex({ projectId: 1, serviceId: 1, fingerprint: 1, createdAt: -1 });
  }

  async process(job: LogProcessingJob) {
    if (!Types.ObjectId.isValid(job.rawLogId)) return;

    const rawLog = await this.rawLogs().findOne({ _id: new Types.ObjectId(job.rawLogId) });
    if (!rawLog) return;

    const parsed = generateFingerprint({
      serviceName: rawLog.serviceName,
      sourceType: rawLog.sourceType,
      level: rawLog.level,
      message: rawLog.message,
      stackTrace: rawLog.stackTrace,
      api: rawLog.api,
    });

    await this.parsedLogs().updateOne(
      { rawLogId: job.rawLogId },
      {
        $setOnInsert: {
          rawLogId: job.rawLogId,
          projectId: rawLog.projectId,
          serviceId: rawLog.serviceId,
          sourceType: rawLog.sourceType,
          level: rawLog.level,
          createdAt: new Date(),
        },
        $set: {
          normalizedMessage: parsed.normalizedMessage,
          fingerprint: parsed.fingerprint,
          stackTraceHash: parsed.stackTraceHash,
        },
      },
      { upsert: true },
    );

    const nowMs = Date.now();
    const count10m = await this.redis.countInWindow(
      `fingerprint:${rawLog.projectId}:${rawLog.serviceId}:${parsed.fingerprint}:10m`,
      job.rawLogId,
      nowMs,
      this.tenMinutesMs,
    );
    const fatalCount5m =
      rawLog.level === 'fatal'
        ? await this.redis.countInWindow(
            `fingerprint:${rawLog.projectId}:${rawLog.serviceId}:${parsed.fingerprint}:fatal:5m`,
            job.rawLogId,
            nowMs,
            this.fiveMinutesMs,
          )
        : 0;
    // Feed the dashboard live tail. Only error and fatal logs reach this point, so the
    // event volume is already bounded by the queue filter.
    void this.events.publish({
      type: 'log.error',
      projectId: rawLog.projectId,
      payload: {
        logId: job.rawLogId,
        serviceId: rawLog.serviceId,
        serviceName: rawLog.serviceName,
        environment: rawLog.environment,
        level: rawLog.level,
        message: rawLog.message,
        timestamp: rawLog.timestamp,
        fingerprint: parsed.fingerprint,
      },
    });

    const severity = triggeredIncidentSeverity(count10m, fatalCount5m);
    if (!severity) return;

    return this.upsertIncident({
      projectId: rawLog.projectId,
      serviceId: rawLog.serviceId,
      rawLogId: job.rawLogId,
      fingerprint: parsed.fingerprint,
      title: parsed.normalizedMessage.slice(0, 160),
      severity,
      recentCount: count10m,
      timestamp: rawLog.timestamp,
    });
  }

  /**
   * Creates or updates the incident for one detection.
   *
   * The read is only used to describe *what changed* in the incident timeline. The write
   * itself is a single atomic upsert on the unique fingerprint key, so two workers racing
   * on the same fingerprint can no longer make each other fail with a unique violation.
   */
  private async upsertIncident(input: IncidentDetection) {
    const where = {
      projectId_serviceId_fingerprint: {
        projectId: input.projectId,
        serviceId: input.serviceId,
        fingerprint: input.fingerprint,
      },
    };
    const existing = await this.prisma.incident.findUnique({
      where,
      select: { id: true, severity: true, status: true, firstSeenAt: true, lastSeenAt: true },
    });
    const plan = existing ? planIncidentUpdate(existing, input) : undefined;
    const incident = await this.prisma.incident.upsert({
      where,
      create: {
        projectId: input.projectId,
        serviceId: input.serviceId,
        fingerprint: input.fingerprint,
        title: input.title,
        severity: input.severity,
        occurrenceCount: input.recentCount,
        recentCount: input.recentCount,
        firstSeenAt: input.timestamp,
        lastSeenAt: input.timestamp,
        lastRawLogId: input.rawLogId,
      },
      update: plan?.update ?? {
        title: input.title,
        severity: input.severity,
        recentCount: input.recentCount,
        occurrenceCount: { increment: 1 },
        lastSeenAt: input.timestamp,
        lastRawLogId: input.rawLogId,
      },
    });
    const event = existing ? plan?.event : createdIncidentEvent(input);

    if (event) {
      await this.prisma.incidentEvent.create({
        data: {
          incidentId: incident.id,
          type: event.type,
          message: event.message,
          metadata: event.metadata,
        },
      });
    }

    const trigger = alertTriggerFor(existing, input);
    this.metrics.incidents.inc({
      action: existing ? 'updated' : 'created',
      severity: incident.severity,
    });

    // Push to open dashboards on every occurrence, not just alert-worthy ones: the live
    // feed is cheap and an operator watching the page wants the counter to move.
    void this.events.publish({
      type: existing ? 'incident.updated' : 'incident.created',
      projectId: incident.projectId,
      payload: {
        incidentId: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        serviceId: incident.serviceId,
        occurrenceCount: incident.occurrenceCount,
        recentCount: incident.recentCount,
        lastSeenAt: incident.lastSeenAt,
        trigger,
      },
    });

    if (trigger) await this.notify(incident, trigger);

    return { incident, created: !existing, event, trigger };
  }

  /** Alerting and analysis are side effects: neither may take the log job down with it. */
  private async notify(incident: Incident, trigger: AlertTrigger) {
    try {
      const service = await this.prisma.service.findUnique({ where: { id: incident.serviceId } });
      if (!service) return;

      await this.alerts.dispatch({ incident, service, trigger });
    } catch (error) {
      this.logger.warn({ incidentId: incident.id, err: String(error) }, 'alert dispatch failed');
    }

    try {
      await this.analysis.enqueue({
        incidentId: incident.id,
        severity: incident.severity,
        trigger,
      });
    } catch (error) {
      this.logger.warn({ incidentId: incident.id, err: String(error) }, 'analysis enqueue failed');
    }
  }

  private rawLogs(): Collection<RawLog> {
    return this.mongo.collection<RawLog>(RAW_LOG_COLLECTION);
  }

  private parsedLogs() {
    return this.mongo.collection(PARSED_LOG_COLLECTION);
  }
}
