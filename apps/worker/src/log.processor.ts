import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LOG_PROCESSING_QUEUE, PinoLogger } from '../../../packages/shared/src';

@Processor(LOG_PROCESSING_QUEUE)
export class LogProcessor extends WorkerHost {
  constructor(private readonly logger: PinoLogger) {
    super();
  }

  async process(job: Job) {
    this.logger.log({ jobId: job.id, name: job.name }, 'received log processing job');
  }
}
