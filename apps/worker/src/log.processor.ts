import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LOG_PROCESSING_QUEUE, PinoLogger } from '../../../packages/shared/src';
import { LogProcessingService } from './log-processing.service';

type LogProcessingJob = {
  rawLogId: string;
  projectId: string;
  serviceId: string;
  sourceType: string;
  level: string;
};

@Processor(LOG_PROCESSING_QUEUE)
export class LogProcessor extends WorkerHost {
  constructor(
    private readonly logger: PinoLogger,
    private readonly logProcessingService: LogProcessingService,
  ) {
    super();
  }

  async process(job: Job<LogProcessingJob>) {
    await this.logProcessingService.process(job.data);
    this.logger.log({ jobId: job.id, rawLogId: job.data.rawLogId }, 'processed log job');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<LogProcessingJob> | undefined, error: Error) {
    this.logger.error({ jobId: job?.id, rawLogId: job?.data.rawLogId, err: error }, undefined, 'log job failed');
  }
}
