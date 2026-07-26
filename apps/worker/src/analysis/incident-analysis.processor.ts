import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  INCIDENT_ANALYSIS_QUEUE,
  IncidentAnalyzerService,
  MetricsService,
  PinoLogger,
  PrismaService,
} from '../../../../packages/shared/src';

export type IncidentAnalysisJob = { incidentId: string };

// AI calls are slow and rate limited upstream, so this queue stays far below the log
// processing concurrency.
const concurrency = Math.max(1, Number(process.env.ANALYSIS_CONCURRENCY) || 2);

@Processor(INCIDENT_ANALYSIS_QUEUE, { concurrency })
export class IncidentAnalysisProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyzer: IncidentAnalyzerService,
    private readonly metrics: MetricsService,
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<IncidentAnalysisJob>) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: job.data.incidentId },
      include: { service: true },
    });

    // The incident can be gone by the time the job runs, e.g. its project was deleted.
    if (!incident) return;

    const result = await this.metrics.timeJob(INCIDENT_ANALYSIS_QUEUE, () => this.analyzer.analyze(incident));
    this.logger.log({ incidentId: incident.id, status: result.status }, 'incident analysed');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<IncidentAnalysisJob> | undefined, error: Error) {
    this.logger.error(
      { jobId: job?.id, incidentId: job?.data.incidentId, err: error },
      undefined,
      'incident analysis job failed',
    );
  }
}
