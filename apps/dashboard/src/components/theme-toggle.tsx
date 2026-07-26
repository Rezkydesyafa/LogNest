'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The store never changes after hydration, so it never needs to notify. */
const subscribeNever = () => () => {};

const ORDER = ['system', 'light', 'dark'] as const;
const ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };
const LABELS = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };

/**
 * Cycles system → light → dark.
 *
 * Rendering is deferred until after mount: the server does not know the stored preference,
 * so drawing an icon before hydration guarantees a mismatch.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // false while server-rendering, true on the client, without a setState-in-effect round trip.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const current = (mounted ? (theme as (typeof ORDER)[number]) : 'system') ?? 'system';
  const Icon = ICONS[current] ?? MonitorIcon;

  return (
    <Button
      variant="ghost"
      size="icon"
      title={LABELS[current]}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])}
    >
      {mounted ? <Icon /> : <MonitorIcon />}
      <span className="sr-only">{LABELS[current]}, click to change</span>
    </Button>
  );
}
