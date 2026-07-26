import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LOG_PROCESSING_QUEUE, MetricsService, PinoLogger } from '../../../packages/shared/src';
import { LogProcessingService } from './log-processing.service';

type LogProcessingJob = {
  rawLogId: string;
  projectId: string;
  serviceId: string;
  sourceType: string;
  level: string;
};

// Incident upserts are atomic on the fingerprint unique key, so jobs for the same
// fingerprint can safely run side by side.
const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY) || 5);

@Processor(LOG_PROCESSING_QUEUE, { concurrency })
export class LogProcessor extends WorkerHost {
  constructor(
    private readonly logger: PinoLogger,
    private readonly logProcessingService: LogProcessingService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  async process(job: Job<LogProcessingJob>) {
    await this.metrics.timeJob(LOG_PROCESSING_QUEUE, () => this.logProcessingService.process(job.data));
    this.logger.log({ jobId: job.id, rawLogId: job.data.rawLogId }, 'processed log job');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<LogProcessingJob> | undefined, error: Error) {
    this.logger.error(
      { jobId: job?.id, rawLogId: job?.data.rawLogId, err: error },
      undefined,
      'log job failed',
    );
  }
}
