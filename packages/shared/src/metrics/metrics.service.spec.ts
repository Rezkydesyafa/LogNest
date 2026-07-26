import { beforeEach, describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let metrics: MetricsService;

  beforeEach(() => {
    metrics = new MetricsService();
  });

  it('renders in the Prometheus text format', async () => {
    expect(metrics.contentType).toContain('text/plain');
    expect(await metrics.render()).toContain('# HELP');
  });

  it('includes Node process defaults so the runtime is observable too', async () => {
    expect(await metrics.render()).toContain('process_cpu_user_seconds_total');
  });

  it('exposes the ingestion counter with its labels', async () => {
    metrics.logsIngested.inc({ source_type: 'docker', level: 'error' }, 3);

    const rendered = await metrics.render();

    expect(rendered).toContain('logmind_logs_ingested_total');
    expect(rendered).toContain('source_type="docker"');
    expect(rendered).toContain('level="error"');
  });

  it('tracks queue depth as a gauge that can go down again', async () => {
    metrics.queueDepth.set({ queue: 'log-processing', state: 'waiting' }, 12);
    metrics.queueDepth.set({ queue: 'log-processing', state: 'waiting' }, 4);

    expect(await metrics.render()).toMatch(
      /logmind_queue_depth\{[^}]*queue="log-processing"[^}]*state="waiting"[^}]*\} 4/,
    );
  });

  it('counts a successful job and records its duration', async () => {
    await expect(metrics.timeJob('log-processing', async () => 'done')).resolves.toBe('done');

    const rendered = await metrics.render();

    expect(rendered).toMatch(/logmind_jobs_processed_total\{[^}]*result="success"[^}]*\} 1/);
    expect(rendered).toMatch(/logmind_job_duration_seconds_count\{[^}]*queue="log-processing"[^}]*\} 1/);
  });

  it('counts a failed job and rethrows the original error', async () => {
    await expect(
      metrics.timeJob('log-processing', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await metrics.render()).toMatch(/logmind_jobs_processed_total\{[^}]*result="failure"[^}]*\} 1/);
  });

  it('labels every series with the process it came from', async () => {
    expect(await metrics.render()).toContain('logmind_process=');
  });
});
