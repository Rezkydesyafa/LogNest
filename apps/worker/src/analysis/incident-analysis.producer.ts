import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertTrigger, IncidentSeverity } from '@prisma/client';
import { Queue } from 'bullmq';
import { INCIDENT_ANALYSIS_QUEUE, RedisService, SEVERITY_RANK } from '../../../../packages/shared/src';

const DEFAULT_COOLDOWN_MINUTES = 360;

@Injectable()
export class IncidentAnalysisProducer {
  constructor(
    @InjectQueue(INCIDENT_ANALYSIS_QUEUE) private readonly queue: Queue,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Queues an automatic analysis for a freshly raised incident.
   *
   * Two guards keep the model bill bounded: a severity floor (default HIGH) and a per
   * incident cooldown, so a noisy incident is analysed once per window rather than once
   * per error log.
   */
  async enqueue(input: { incidentId: string; severity: IncidentSeverity; trigger: AlertTrigger }) {
    if (!this.enabled) return false;
    if (SEVERITY_RANK[input.severity] < SEVERITY_RANK[this.minSeverity]) return false;
    if (!(await this.redis.claim(`analysis:${input.incidentId}`, this.cooldownMs))) return false;

    await this.queue.add(
      'analyze-incident',
      { incidentId: input.incidentId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    );

    return true;
  }

  private get enabled() {
    return this.config.get<string>('AUTO_ANALYSIS_ENABLED') !== 'false';
  }

  private get minSeverity() {
    const configured = this.config.get<string>('AUTO_ANALYSIS_MIN_SEVERITY');
    return configured && configured in SEVERITY_RANK
      ? (configured as IncidentSeverity)
      : IncidentSeverity.HIGH;
  }

  private get cooldownMs() {
    const minutes = Number(this.config.get('AUTO_ANALYSIS_COOLDOWN_MINUTES'));
    return (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_COOLDOWN_MINUTES) * 60_000;
  }
}
