import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DEFAULT_REDIS_URL } from '../constants';

export type ProjectEventType = 'incident.created' | 'incident.updated' | 'incident.resolved' | 'log.error';

export type ProjectEvent = {
  type: ProjectEventType;
  projectId: string;
  at: string;
  payload: Record<string, unknown>;
};

const CHANNEL_PREFIX = 'logmind:events:';

export function projectChannel(projectId: string) {
  return `${CHANNEL_PREFIX}${projectId}`;
}

export function projectIdFromChannel(channel: string) {
  return channel.startsWith(CHANNEL_PREFIX) ? channel.slice(CHANNEL_PREFIX.length) : undefined;
}

export function parseProjectEvent(raw: string): ProjectEvent | undefined {
  try {
    const parsed = JSON.parse(raw) as ProjectEvent;
    return parsed && typeof parsed.type === 'string' && typeof parsed.projectId === 'string'
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Redis pub/sub bridge for live dashboard updates.
 *
 * The worker publishes; every API replica subscribes and fans out to the browsers it holds
 * open. Going through Redis instead of an in-process emitter is what lets the dashboard
 * stay live when the API runs more than one instance.
 */
@Injectable()
export class ProjectEventsService implements OnModuleInit, OnModuleDestroy {
  private publisher?: Redis;
  private subscriber?: Redis;
  private readonly listeners = new Set<(event: ProjectEvent) => void>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL') ?? DEFAULT_REDIS_URL;

    this.publisher = new Redis(url, { maxRetriesPerRequest: 3, enableOfflineQueue: false });
    this.publisher.on('error', () => undefined);
  }

  async publish(event: Omit<ProjectEvent, 'at'> & { at?: string }) {
    if (!this.publisher) return false;

    try {
      await this.publisher.publish(
        projectChannel(event.projectId),
        JSON.stringify({ ...event, at: event.at ?? new Date().toISOString() }),
      );
      return true;
    } catch {
      // Live updates are a convenience; the dashboard still works by polling.
      return false;
    }
  }

  /**
   * Subscribes to every project channel once and filters per listener, so N open browser
   * tabs do not open N Redis subscriptions.
   */
  async subscribe(listener: (event: ProjectEvent) => void) {
    await this.ensureSubscriber();
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  get listenerCount() {
    return this.listeners.size;
  }

  private async ensureSubscriber() {
    if (this.subscriber) return;

    const url = this.config.get<string>('REDIS_URL') ?? DEFAULT_REDIS_URL;
    this.subscriber = new Redis(url, { maxRetriesPerRequest: null });
    this.subscriber.on('error', () => undefined);
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      const event = parseProjectEvent(message);
      const projectId = projectIdFromChannel(channel);
      if (!event || !projectId) return;

      for (const listener of this.listeners) listener({ ...event, projectId });
    });

    await this.subscriber.psubscribe(`${CHANNEL_PREFIX}*`);
  }

  async onModuleDestroy() {
    this.listeners.clear();
    await Promise.all([
      this.publisher?.quit().catch(() => undefined),
      this.subscriber?.quit().catch(() => undefined),
    ]);
  }
}
