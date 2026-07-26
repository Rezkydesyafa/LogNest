import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  INCIDENT_ANALYSIS_QUEUE,
  LOG_PROCESSING_QUEUE,
  MetricsService,
} from '../../../../packages/shared/src';

const DEFAULT_INTERVAL_MS = 15_000;

/**
 * Polls BullMQ for queue depth.
 *
 * Queue depth is the earliest signal that ingestion is outrunning processing, and it is
 * only observable by asking Redis, so it is sampled on a timer rather than derived from
 * counters.
 */
@Injectable()
export class QueueDepthCollector implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectQueue(LOG_PROCESSING_QUEUE) private readonly logQueue: Queue,
    @InjectQueue(INCIDENT_ANALYSIS_QUEUE) private readonly analysisQueue: Queue,
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const interval = this.config.get<number>('QUEUE_METRICS_INTERVAL_MS') ?? DEFAULT_INTERVAL_MS;

    void this.collect();
    this.timer = setInterval(() => void this.collect(), interval);
    this.timer.unref?.();
  }

  async collect() {
    await Promise.all([this.sample(this.logQueue), this.sample(this.analysisQueue)]);
  }

  private async sample(queue: Queue) {
    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');

      for (const [state, value] of Object.entries(counts)) {
        this.metrics.queueDepth.set({ queue: queue.name, state }, Number(value) || 0);
      }
    } catch {
      // Redis is momentarily unavailable: skip this sample rather than crash the worker.
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
