import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LOG_PROCESSING_QUEUE } from '../../../../../packages/shared/src';

export type QueueableLog = {
  id: string;
  projectId: string;
  serviceId: string;
  sourceType: string;
  level: string;
};

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: 1000,
  removeOnFail: 1000,
};

/** Only error and fatal logs reach the incident pipeline; everything else is stored and ignored. */
export function isQueueable(level: string) {
  return level === 'error' || level === 'fatal';
}

@Injectable()
export class LogQueueProducer {
  constructor(@InjectQueue(LOG_PROCESSING_QUEUE) private readonly queue: Queue) {}

  async enqueueIfRelevant(log: QueueableLog) {
    if (!isQueueable(log.level)) return false;

    await this.queue.add('process-log', jobData(log), JOB_OPTIONS);
    return true;
  }

  /** One round trip to Redis for a whole batch instead of one per log. */
  async enqueueMany(logs: QueueableLog[]) {
    const jobs = logs.filter((log) => isQueueable(log.level));
    if (!jobs.length) return 0;

    await this.queue.addBulk(
      jobs.map((log) => ({ name: 'process-log', data: jobData(log), opts: JOB_OPTIONS })),
    );

    return jobs.length;
  }
}

function jobData(log: QueueableLog) {
  return {
    rawLogId: log.id,
    projectId: log.projectId,
    serviceId: log.serviceId,
    sourceType: log.sourceType,
    level: log.level,
  };
}
