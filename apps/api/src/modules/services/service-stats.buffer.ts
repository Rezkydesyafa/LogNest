import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../../packages/shared/src';

export type ServiceStatsDelta = { logCount: number; errorCount: number; lastSeenAt: Date };

const DEFAULT_FLUSH_INTERVAL_MS = 5_000;

/**
 * Accumulates per-service log counters in memory and writes them in one batch.
 *
 * Ingestion used to issue a Postgres read plus a Postgres write for every single log line.
 * Counters are pure statistics, so trading exact real-time accuracy for one batched
 * `increment` per service per flush removes that write from the hot path entirely.
 */
@Injectable()
export class ServiceStatsBuffer implements OnModuleInit, OnModuleDestroy {
  private readonly pending = new Map<string, ServiceStatsDelta>();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const interval = this.config.get<number>('SERVICE_STATS_FLUSH_MS') ?? DEFAULT_FLUSH_INTERVAL_MS;

    this.timer = setInterval(() => void this.flush(), interval);
    // Never hold the event loop open just to flush statistics.
    this.timer.unref?.();
  }

  record(serviceId: string, input: { isError: boolean; timestamp: Date }) {
    const current = this.pending.get(serviceId);

    if (!current) {
      this.pending.set(serviceId, {
        logCount: 1,
        errorCount: input.isError ? 1 : 0,
        lastSeenAt: input.timestamp,
      });
      return;
    }

    current.logCount += 1;
    if (input.isError) current.errorCount += 1;
    if (input.timestamp > current.lastSeenAt) current.lastSeenAt = input.timestamp;
  }

  /** Number of services with unwritten counters. Exposed for health reporting and tests. */
  get pendingServices() {
    return this.pending.size;
  }

  async flush() {
    if (!this.pending.size) return;

    // Swap first: logs that arrive during the write land in the next batch instead of
    // being dropped by the clear below.
    const batch = [...this.pending.entries()];
    this.pending.clear();

    await Promise.all(
      batch.map(async ([serviceId, delta]) => {
        try {
          await this.prisma.service.update({
            where: { id: serviceId },
            data: {
              logCount: { increment: delta.logCount },
              errorCount: { increment: delta.errorCount },
              lastSeenAt: delta.lastSeenAt,
            },
          });
        } catch {
          // The service row was deleted between buffering and flushing: drop the counters.
        }
      }),
    );
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }
}
