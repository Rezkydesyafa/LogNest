'use client';

import { createContext, useContext, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { DashboardRange } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
];
const STORAGE_KEY = 'logmind_dashboard_range';
const TimeRangeContext = createContext<{
  range: DashboardRange;
  setRange(value: DashboardRange): void;
} | null>(null);

export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setValue] = useState<DashboardRange>(() => {
    if (typeof window === 'undefined') return '24h';
    const stored = localStorage.getItem(STORAGE_KEY) as DashboardRange | null;
    return OPTIONS.some((option) => option.value === stored) ? stored! : '24h';
  });

  function setRange(value: DashboardRange) {
    localStorage.setItem(STORAGE_KEY, value);
    setValue(value);
  }

  return <TimeRangeContext.Provider value={{ range, setRange }}>{children}</TimeRangeContext.Provider>;
}

export function useTimeRange() {
  const value = useContext(TimeRangeContext);
  if (!value) throw new Error('useTimeRange must be used within TimeRangeProvider');
  return value;
}

export function TimeRangePicker() {
  const pathname = usePathname();
  const { range, setRange } = useTimeRange();
  const visible =
    ['/overview', '/logs', '/incidents', '/services'].includes(pathname) || pathname.startsWith('/services/');
  if (!visible) return null;

  return (
    <Select value={range} onValueChange={(value) => setRange(value as DashboardRange)}>
      <SelectTrigger aria-label="Dashboard time range" className="w-24 sm:w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function rangeStart(range: DashboardRange, now = Date.now()) {
  const minutes: Record<DashboardRange, number> = {
    '15m': 15,
    '1h': 60,
    '6h': 360,
    '24h': 1440,
    '7d': 10080,
  };
  return new Date(now - minutes[range] * 60_000).toISOString();
}
