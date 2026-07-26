import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

/** Buckets tuned for an HTTP API: sub-millisecond is noise, anything past 10s is a timeout. */
const HTTP_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const JOB_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];

/**
 * Prometheus registry shared by the API and the worker.
 *
 * A logging platform that cannot report on itself is a blind spot, so both processes expose
 * the same metric names with a `logmind_process` label to tell them apart.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequests: Counter<'method' | 'route' | 'status'>;
  readonly httpDuration: Histogram<'method' | 'route'>;
  readonly logsIngested: Counter<'source_type' | 'level'>;
  readonly logsQueued: Counter<string>;
  readonly jobsProcessed: Counter<'queue' | 'result'>;
  readonly jobDuration: Histogram<'queue'>;
  readonly incidents: Counter<'action' | 'severity'>;
  readonly alerts: Counter<'channel' | 'status'>;
  readonly analyses: Counter<'status'>;
  readonly queueDepth: Gauge<'queue' | 'state'>;

  constructor() {
    this.registry.setDefaultLabels({ logmind_process: process.env.LOGMIND_PROCESS ?? 'api' });
    collectDefaultMetrics({ register: this.registry });

    this.httpRequests = new Counter({
      name: 'logmind_http_requests_total',
      help: 'HTTP requests handled, by method, route template, and status code.',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    this.httpDuration = new Histogram({
      name: 'logmind_http_request_duration_seconds',
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'route'],
      buckets: HTTP_BUCKETS,
      registers: [this.registry],
    });
    this.logsIngested = new Counter({
      name: 'logmind_logs_ingested_total',
      help: 'Log entries accepted by the ingestion endpoints.',
      labelNames: ['source_type', 'level'],
      registers: [this.registry],
    });
    this.logsQueued = new Counter({
      name: 'logmind_logs_queued_total',
      help: 'Log entries handed to the incident processing queue.',
      registers: [this.registry],
    });
    this.jobsProcessed = new Counter({
      name: 'logmind_jobs_processed_total',
      help: 'Queue jobs finished, by queue and outcome.',
      labelNames: ['queue', 'result'],
      registers: [this.registry],
    });
    this.jobDuration = new Histogram({
      name: 'logmind_job_duration_seconds',
      help: 'Queue job duration in seconds.',
      labelNames: ['queue'],
      buckets: JOB_BUCKETS,
      registers: [this.registry],
    });
    this.incidents = new Counter({
      name: 'logmind_incidents_total',
      help: 'Incident lifecycle transitions, by action and severity.',
      labelNames: ['action', 'severity'],
      registers: [this.registry],
    });
    this.alerts = new Counter({
      name: 'logmind_alerts_total',
      help: 'Alert deliveries attempted, by channel type and outcome.',
      labelNames: ['channel', 'status'],
      registers: [this.registry],
    });
    this.analyses = new Counter({
      name: 'logmind_ai_analyses_total',
      help: 'AI incident analyses completed, by outcome.',
      labelNames: ['status'],
      registers: [this.registry],
    });
    this.queueDepth = new Gauge({
      name: 'logmind_queue_depth',
      help: 'Jobs currently in a queue, by state.',
      labelNames: ['queue', 'state'],
      registers: [this.registry],
    });
  }

  /** Times an operation and records the outcome under the given queue label. */
  async timeJob<T>(queue: string, run: () => Promise<T>): Promise<T> {
    const end = this.jobDuration.startTimer({ queue });

    try {
      const result = await run();
      this.jobsProcessed.inc({ queue, result: 'success' });
      return result;
    } catch (error) {
      this.jobsProcessed.inc({ queue, result: 'failure' });
      throw error;
    } finally {
      end();
    }
  }

  render() {
    return this.registry.metrics();
  }

  get contentType() {
    return this.registry.contentType;
  }
}
