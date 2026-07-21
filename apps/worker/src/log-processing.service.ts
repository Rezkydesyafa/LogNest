import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { IncidentEventType, IncidentSeverity, IncidentStatus } from '@prisma/client';
import { Collection, Connection, Types } from 'mongoose';
import {
  generateFingerprint,
  LogLevel,
  PARSED_LOG_COLLECTION,
  PrismaService,
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
    @InjectConnection() private readonly mongo: Connection,
  ) {}

  async onModuleInit() {
    await this.parsedLogs().createIndex({ rawLogId: 1 }, { unique: true });
    await this.parsedLogs().createIndex({ projectId: 1, serviceId: 1, fingerprint: 1 });
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
    const severity = triggeredIncidentSeverity(count10m, fatalCount5m);
    if (!severity) return;

    await this.upsertIncident({
      projectId: rawLog.projectId,
      serviceId: rawLog.serviceId,
      rawLogId: job.rawLogId,
      fingerprint: parsed.fingerprint,
      title: parsed.normalizedMessage.slice(0, 160),
      severity,
      count10m,
      timestamp: rawLog.timestamp,
    });
  }

  private async upsertIncident(input: {
    projectId: string;
    serviceId: string;
    rawLogId: string;
    fingerprint: string;
    title: string;
    severity: IncidentSeverity;
    count10m: number;
    timestamp: Date;
  }) {
    const existing = await this.prisma.incident.findUnique({
      where: {
        projectId_serviceId_fingerprint: {
          projectId: input.projectId,
          serviceId: input.serviceId,
          fingerprint: input.fingerprint,
        },
      },
    });

    if (!existing) {
      const incident = await this.prisma.incident.create({
        data: {
          projectId: input.projectId,
          serviceId: input.serviceId,
          fingerprint: input.fingerprint,
          title: input.title,
          severity: input.severity,
          occurrenceCount: input.count10m,
          firstSeenAt: input.timestamp,
          lastSeenAt: input.timestamp,
          lastRawLogId: input.rawLogId,
        },
      });

      await this.prisma.incidentEvent.create({
        data: {
          incidentId: incident.id,
          type: IncidentEventType.CREATED,
          message: `Incident created with ${input.severity.toLowerCase()} severity`,
          metadata: { count10m: input.count10m },
        },
      });
      return;
    }

    const severityChanged = existing.severity !== input.severity;
    const reopened = existing.status === IncidentStatus.RESOLVED;
    const incident = await this.prisma.incident.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        severity: input.severity,
        occurrenceCount: input.count10m,
        lastSeenAt: input.timestamp,
        lastRawLogId: input.rawLogId,
        ...(reopened ? { status: IncidentStatus.OPEN, resolvedAt: null } : {}),
      },
    });

    await this.prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: reopened ? IncidentEventType.STATUS_CHANGED : IncidentEventType.UPDATED,
        message: reopened
          ? 'Incident reopened after the fingerprint threshold was reached again'
          : severityChanged
            ? `Severity changed from ${existing.severity.toLowerCase()} to ${input.severity.toLowerCase()}`
            : 'Incident occurrence updated',
        metadata: { count10m: input.count10m, rawLogId: input.rawLogId },
      },
    });
  }

  private rawLogs(): Collection<RawLog> {
    return this.mongo.collection<RawLog>(RAW_LOG_COLLECTION);
  }

  private parsedLogs() {
    return this.mongo.collection(PARSED_LOG_COLLECTION);
  }
}
