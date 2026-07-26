import { describe, expect, it, vi } from 'vitest';
import { LogBatcher } from './log-batcher';
import { DockerLogPayload } from './logmind-client';

const payload = (message: string): DockerLogPayload => ({
  sourceType: 'docker',
  serviceName: 'payment-service',
  environment: 'development',
  level: 'info',
  message,
  timestamp: '2026-07-26T10:00:00.000Z',
  metadata: {},
});

const options = { maxBatchSize: 3, flushIntervalMs: 5, maxQueueSize: 5 };

describe('LogBatcher', () => {
  it('flushes as soon as the batch is full', async () => {
    const sink = vi.fn().mockResolvedValue(true);
    const batcher = new LogBatcher(sink, options);

    batcher.add(payload('a'));
    batcher.add(payload('b'));
    expect(sink).not.toHaveBeenCalled();

    batcher.add(payload('c'));
    await vi.waitFor(() => expect(sink).toHaveBeenCalledOnce());
    expect(sink.mock.calls[0][0].map((log: DockerLogPayload) => log.message)).toEqual(['a', 'b', 'c']);
  });

  it('flushes a partial batch once the interval elapses', async () => {
    const sink = vi.fn().mockResolvedValue(true);
    const batcher = new LogBatcher(sink, options);

    batcher.add(payload('a'));

    await vi.waitFor(() => expect(sink).toHaveBeenCalledOnce());
    expect(sink.mock.calls[0][0]).toHaveLength(1);
  });

  it('does nothing when there is nothing buffered', async () => {
    const sink = vi.fn().mockResolvedValue(true);

    await new LogBatcher(sink, options).flush();

    expect(sink).not.toHaveBeenCalled();
  });

  it('drops the oldest lines once the queue ceiling is reached', async () => {
    const onDrop = vi.fn();
    // A sink that never settles keeps the first flush in flight so the buffer really fills.
    const batcher = new LogBatcher(() => new Promise(() => undefined), options, onDrop);

    for (const message of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
      batcher.add(payload(message));
    }

    expect(batcher.size).toBeLessThanOrEqual(options.maxQueueSize);
    expect(batcher.dropped).toBeGreaterThan(0);
  });

  it('keeps accepting logs after the sink fails', async () => {
    const sink = vi.fn().mockRejectedValue(new Error('api down'));
    const batcher = new LogBatcher(sink, options);

    batcher.add(payload('a'));
    batcher.add(payload('b'));
    batcher.add(payload('c'));
    await vi.waitFor(() => expect(sink).toHaveBeenCalledOnce());

    expect(() => batcher.add(payload('d'))).not.toThrow();
    expect(batcher.size).toBe(1);
  });

  it('runs one flush at a time', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const batcher = new LogBatcher(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    }, options);

    for (const message of ['a', 'b', 'c', 'd', 'e', 'f']) batcher.add(payload(message));
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(maxInFlight).toBe(1);
  });

  it('drains the buffer on stop', async () => {
    const sink = vi.fn().mockResolvedValue(true);
    const batcher = new LogBatcher(sink, options);

    batcher.add(payload('a'));
    batcher.add(payload('b'));
    await batcher.stop();

    expect(sink).toHaveBeenCalledOnce();
    expect(batcher.size).toBe(0);
  });

  it('stops draining instead of spinning when the sink keeps failing', async () => {
    const batcher = new LogBatcher(async () => {
      throw new Error('api down');
    }, options);

    batcher.add(payload('a'));

    await expect(batcher.stop()).resolves.toBeUndefined();
  });
});
