'use client';

import { useEffect, useRef, useState } from 'react';

export type ProjectEvent = {
  type: string;
  projectId: string;
  at: string;
  payload: Record<string, unknown>;
};

const FORWARDED_EVENTS = ['incident.created', 'incident.updated', 'incident.resolved', 'log.error'];

/**
 * Subscribes to the project's live incident feed.
 *
 * `EventSource` cannot send an Authorization header, which is exactly why the dashboard
 * proxies through its own cookie-authenticated route. It also reconnects on its own, so
 * there is no retry logic here.
 */
export function useProjectEvents(projectId: string | undefined, onEvent: (event: ProjectEvent) => void) {
  const [connected, setConnected] = useState(false);
  // Kept in a ref so a new inline callback on every render does not resubscribe.
  const handler = useRef(onEvent);

  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!projectId || typeof window === 'undefined') return;

    const source = new EventSource(`/api/logmind/events?projectId=${encodeURIComponent(projectId)}`);
    const forward = (event: MessageEvent<string>) => {
      try {
        handler.current(JSON.parse(event.data) as ProjectEvent);
      } catch {
        // A malformed frame is not worth breaking the stream over.
      }
    };

    source.addEventListener('ready', () => setConnected(true));
    for (const name of FORWARDED_EVENTS) source.addEventListener(name, forward as EventListener);
    source.onerror = () => setConnected(false);

    return () => {
      setConnected(false);
      source.close();
    };
  }, [projectId]);

  return { connected };
}
