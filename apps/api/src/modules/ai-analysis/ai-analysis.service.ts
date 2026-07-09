import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PrismaService } from '../../../../../packages/shared/src';
import { ParsedLog } from '../logs/schemas/parsed-log.schema';
import { RawLog } from '../logs/schemas/raw-log.schema';
import { AiAnalysisValidator } from './ai-analysis.validator';
import { AI_PROVIDER, AiProvider } from './ai-provider.interface';
import { PromptBuilderService } from './prompt-builder.service';
import { AiAnalysisResult } from './schemas/ai-analysis-result.schema';

@Injectable()
export class AiAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly validator: AiAnalysisValidator,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    @InjectModel(RawLog.name) private readonly rawLogModel: Model<RawLog>,
    @InjectModel(ParsedLog.name) private readonly parsedLogModel: Model<ParsedLog>,
    @InjectModel(AiAnalysisResult.name) private readonly aiAnalysisModel: Model<AiAnalysisResult>,
  ) {}

  async analyze(ownerId: string, incidentId: string) {
    const incident = await this.incidentFor(ownerId, incidentId);
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
        firstSeenAt: incident.firstSeenAt,
        lastSeenAt: incident.lastSeenAt,
      },
      sampleLogs,
    };
    const prompt = this.promptBuilder.build({ incident, sampleLogs });

    try {
      const output = this.validator.validate(
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

      return {
        status: 'success',
        analysis: output,
        incident: updated,
      };
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
        data: {
          aiLastAnalyzedAt: new Date(),
          aiError: message,
        },
      });

      return {
        status: 'failed',
        error: message,
        incident: updated,
      };
    }
  }

  private async incidentFor(ownerId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: {
        id: incidentId,
        project: { ownerId },
      },
      include: { service: true },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return incident;
  }

  private async sampleLogs(incident: Awaited<ReturnType<AiAnalysisService['incidentFor']>>) {
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

    const logs = await this.rawLogModel.find({ _id: { $in: rawIds } }).sort({ timestamp: -1 }).lean();

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
