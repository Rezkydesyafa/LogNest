import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LOG_PROCESSING_QUEUE } from '../../../../../packages/shared/src';

type QueueableLog = {
  id: string;
  projectId: string;
  serviceId: string;
  sourceType: string;
  level: string;
};

@Injectable()
export class LogQueueProducer {
  constructor(@InjectQueue(LOG_PROCESSING_QUEUE) private readonly queue: Queue) {}

  async enqueueIfRelevant(log: QueueableLog) {
    if (log.level !== 'error' && log.level !== 'fatal') {
      return false;
    }

    await this.queue.add(
      'process-log',
      {
        rawLogId: log.id,
        projectId: log.projectId,
        serviceId: log.serviceId,
        sourceType: log.sourceType,
        level: log.level,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
      },
    );

    return true;
  }
}
