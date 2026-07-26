import { DockerLogPayload } from './logmind-client';

export type LogBatcherOptions = {
  /** Flush once this many logs are buffered. */
  maxBatchSize: number;
  /** Flush at most this long after the first log of a batch arrived. */
  flushIntervalMs: number;
  /** Hard ceiling on buffered logs. Beyond this the oldest are dropped. */
  maxQueueSize: number;
};

export type BatchSink = (batch: DockerLogPayload[]) => Promise<unknown>;

/**
 * Buffers container log lines and hands them over in batches.
 *
 * The agent used to fire one HTTP request per log line with no backpressure: a container
 * that spams output would queue unbounded promises and flood the API. Here the buffer has
 * a hard ceiling, only one flush is in flight at a time, and overflow is dropped loudly
 * rather than silently growing the heap.
 */
export class LogBatcher {
  private buffer: DockerLogPayload[] = [];
  private timer?: NodeJS.Timeout;
  private flushing = false;
  private droppedSinceLastFlush = 0;

  constructor(
    private readonly sink: BatchSink,
    private readonly options: LogBatcherOptions,
    private readonly onDrop: (dropped: number) => void = () => undefined,
  ) {}

  get size() {
    return this.buffer.length;
  }

  get dropped() {
    return this.droppedSinceLastFlush;
  }

  add(payload: DockerLogPayload) {
    if (this.buffer.length >= this.options.maxQueueSize) {
      // Drop the oldest: during an incident the newest lines are the useful ones.
      this.buffer.shift();
      this.droppedSinceLastFlush += 1;
    }

    this.buffer.push(payload);

    if (this.buffer.length >= this.options.maxBatchSize) {
      void this.flush();
      return;
    }

    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.timer) return;

    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.options.flushIntervalMs);
    this.timer.unref?.();
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (!this.buffer.length) return;

    this.flushing = true;
    const batch = this.buffer.splice(0, this.options.maxBatchSize);
    const dropped = this.droppedSinceLastFlush;
    this.droppedSinceLastFlush = 0;

    try {
      if (dropped > 0) this.onDrop(dropped);
      await this.sink(batch);
    } catch {
      // The sink owns its own retries; a batch it could not deliver is gone on purpose so
      // the agent never grows unbounded while the API is down.
    } finally {
      this.flushing = false;
      // More arrived (or the batch was capped) while this flush was running.
      if (this.buffer.length) this.scheduleFlush();
    }
  }

  async stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    while (this.buffer.length) {
      const before = this.buffer.length;
      await this.flush();
      if (this.buffer.length >= before) break;
    }
  }
}
