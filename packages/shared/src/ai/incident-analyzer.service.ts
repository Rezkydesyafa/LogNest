import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Incident, Service } from '@prisma/client';
import { Model, Types } from 'mongoose';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../database/prisma.service';
import { ParsedLog, RawLog } from '../log-storage';
import { AiAnalysisResult } from './ai-analysis-result.schema';
import { validateAiAnalysis } from './ai-analysis-validator';
import { AI_PROVIDER, AiProvider } from './ai-provider.interface';
import { buildPrompt } from './prompt-builder';

export type AnalyzableIncident = Incident & { service: Service };

/**
 * Runs one AI analysis for an incident and persists the result.
 *
 * Deliberately free of any authorization: the API layer checks project access before
 * calling in, and the worker calls in for incidents it already detected itself.
 */
@Injectable()
export class IncidentAnalyzerService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly metrics: MetricsService,
    @InjectModel(RawLog.name) private readonly rawLogModel: Model<RawLog>,
    @InjectModel(ParsedLog.name) private readonly parsedLogModel: Model<ParsedLog>,
    @InjectModel(AiAnalysisResult.name) private readonly aiAnalysisModel: Model<AiAnalysisResult>,
  ) {}

  async analyze(incident: AnalyzableIncident) {
    const sampleLogs = await this.sampleLogs(incident);
    const inputSnapshot = {
      incident: {
        id: incident.id,
        projectId: incident.projectId,
        serviceId: incident.serviceId,
        serviceName: incident.service.name,
        environment: incident.service.environment,
        fingerprint: incident.fingerprint,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        occurrenceCount: incident.occurrenceCount,
        recentCount: incident.recentCount,
        firstSeenAt: incident.firstSeenAt,
        lastSeenAt: incident.lastSeenAt,
      },
      sampleLogs,
    };
    const prompt = buildPrompt({ incident, sampleLogs });

    try {
      const output = validateAiAnalysis(
        await this.provider.analyzeIncident({ incident, sampleLogs, prompt }),
      );

      await this.aiAnalysisModel.create({
        incidentId: incident.id,
        projectId: incident.projectId,
        provider: this.provider.provider,
        model: this.provider.model,
        status: 'success',
        inputSnapshot,
        prompt,
        output,
      });

      const updated = await this.prisma.incident.update({
        where: { id: incident.id },
        data: {
          aiSummary: output.summary,
          aiPossibleCause: output.possibleCause,
          aiImpact: output.impact,
          aiSuggestedActions: output.suggestedActions,
          aiConfidence: output.confidence,
          aiLastAnalyzedAt: new Date(),
          aiError: null,
        },
      });

      this.metrics.analyses.inc({ status: 'success' });
      return { status: 'success' as const, analysis: output, incident: updated };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI provider failed';

      await this.aiAnalysisModel.create({
        incidentId: incident.id,
        projectId: incident.projectId,
        provider: this.provider.provider,
        model: this.provider.model,
        status: 'failed',
        inputSnapshot,
        prompt,
        error: message,
      });

      const updated = await this.prisma.incident.update({
        where: { id: incident.id },
        data: { aiLastAnalyzedAt: new Date(), aiError: message },
      });

      this.metrics.analyses.inc({ status: 'failed' });
      return { status: 'failed' as const, error: message, incident: updated };
    }
  }

  private async sampleLogs(incident: AnalyzableIncident) {
    const parsed = await this.parsedLogModel
      .find({
        projectId: incident.projectId,
        serviceId: incident.serviceId,
        fingerprint: incident.fingerprint,
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    const rawIds = parsed
      .map((log) => String(log.rawLogId))
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (!rawIds.length && incident.lastRawLogId && Types.ObjectId.isValid(incident.lastRawLogId)) {
      rawIds.push(new Types.ObjectId(incident.lastRawLogId));
    }

    const logs = await this.rawLogModel
      .find({ _id: { $in: rawIds } })
      .sort({ timestamp: -1 })
      .lean();

    return logs.map((log) => ({
      id: String(log._id),
      sourceType: log.sourceType,
      level: log.level,
      message: log.message,
      timestamp: log.timestamp,
      api: log.api,
      frontend: log.frontend,
      metadata: log.metadata,
      stackTrace: log.stackTrace,
    }));
  }
}
