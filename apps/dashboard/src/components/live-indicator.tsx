'use client';

import { PauseIcon, PlayIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Connection state for a Server-Sent Events feed, with an optional pause control.
 *
 * A live view that silently stops updating is worse than one that never updated, so the
 * state is always visible: green while streaming, muted while reconnecting or paused.
 */
export function LiveIndicator({
  live,
  connected,
  onToggle,
  pausedHint,
}: {
  live: boolean;
  connected: boolean;
  onToggle?: () => void;
  pausedHint?: string;
}) {
  const label = !live ? 'Paused' : connected ? 'Live' : 'Reconnecting';

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground flex items-center gap-2 text-xs" aria-live="polite">
        <span
          aria-hidden
          className={`size-2 rounded-full ${live && connected ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
        />
        {label}
      </span>
      {pausedHint && live && (
        <span className="text-muted-foreground/70 hidden text-xs sm:inline">{pausedHint}</span>
      )}
      {onToggle && (
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          aria-pressed={live}
          title={live ? 'Pause live updates' : 'Resume live updates'}
        >
          {live ? <PauseIcon data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
          {live ? 'Pause' : 'Resume'}
        </Button>
      )}
    </div>
  );
}
