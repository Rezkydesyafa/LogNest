'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyIcon, ListFilterIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api, formatDate, queryString } from '@/lib/api';
import type { Log, Page, Service } from '@/lib/types';
import { CodeBlock } from '@/components/code-block';
import { PaginationControls } from '@/components/pagination-controls';
import { ErrorState, PageHeader, PageLoading, ProjectRequired } from '@/components/page-state';
import { useProject } from '@/components/project-context';
import { rangeStart, useTimeRange } from '@/components/time-range-context';
import { StatusBadge } from '@/components/status-badge';
import { LiveIndicator } from '@/components/live-indicator';
import { useProjectEvents } from '@/hooks/use-project-events';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Filters = {
  keyword?: string;
  sourceType?: string;
  level?: string;
  environment?: string;
  serviceId?: string;
  from?: string;
  to?: string;
  path?: string;
  statusCode?: string;
  requestId?: string;
};

export default function LogsPage() {
  const { projectId, loading } = useProject();
  const { range } = useTimeRange();
  const client = useQueryClient();
  const [live, setLive] = useState(true);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Log>();
  const defaultFrom = useMemo(() => rangeStart(range), [range]);
  const effectiveFilters = filters.from ? filters : { ...filters, from: defaultFrom };
  const services = useQuery({
    queryKey: ['services', projectId],
    queryFn: () => api<Service[]>(`/projects/${projectId}/services`),
    enabled: Boolean(projectId),
  });
  const logs = useQuery({
    queryKey: ['logs', projectId, effectiveFilters, page],
    queryFn: () =>
      api<Page<Log>>(
        `/logs${queryString({ projectId, ...effectiveFilters, statusCode: effectiveFilters.statusCode ? Number(effectiveFilters.statusCode) : undefined, page, limit: 25 })}`,
      ),
    enabled: Boolean(projectId),
  });

  // Live tail. The worker publishes one event per processed error log, and only the first
  // page is refreshed: paging back through history should not jump under the reader.
  const { connected } = useProjectEvents(live ? projectId : undefined, () => {
    if (page === 1) void client.invalidateQueries({ queryKey: ['logs', projectId] });
  });

  if (loading) return <PageLoading />;
  if (!projectId) return <ProjectRequired />;
  if (logs.error) return <ErrorState error={logs.error} />;
  return (
    <>
      <PageHeader
        title="Logs"
        description={`Search logs received over the last ${range}, or set a custom range.`}
        action={
          <LiveIndicator
            live={live}
            connected={connected}
            onToggle={() => setLive((value) => !value)}
            pausedHint={page > 1 ? 'Paused while paging through history' : undefined}
          />
        }
      />
      <Card className="mb-5">
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setFilters(
                Object.fromEntries(
                  Array.from(data.entries()).map(([key, value]) => [
                    key,
                    value === 'all'
                      ? ''
                      : ['from', 'to'].includes(key) && value
                        ? new Date(String(value)).toISOString()
                        : String(value),
                  ]),
                ),
              );
              setPage(1);
            }}
          >
            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="keyword">Search</FieldLabel>
                <Input
                  id="keyword"
                  name="keyword"
                  defaultValue={filters.keyword}
                  placeholder="Message, stack, URL..."
                />
              </Field>
              <Field>
                <FieldLabel>Service</FieldLabel>
                <Select name="serviceId" defaultValue={filters.serviceId || 'all'}>
                  <SelectTrigger>
                    <SelectValue placeholder="All services" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All services</SelectItem>
                      {(services.data ?? []).map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} · {service.environment}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Source</FieldLabel>
                <Select name="sourceType" defaultValue={filters.sourceType || 'all'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {['all', 'docker', 'api', 'frontend', 'worker', 'manual'].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Level</FieldLabel>
                <Select name="level" defaultValue={filters.level || 'all'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {['all', 'debug', 'info', 'warn', 'error', 'fatal'].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="environment">Environment</FieldLabel>
                <Input
                  id="environment"
                  name="environment"
                  defaultValue={filters.environment}
                  placeholder="production"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="path">API path</FieldLabel>
                <Input id="path" name="path" defaultValue={filters.path} placeholder="/checkout" />
              </Field>
              <Field>
                <FieldLabel htmlFor="statusCode">Status code</FieldLabel>
                <Input
                  id="statusCode"
                  name="statusCode"
                  type="number"
                  min="100"
                  max="599"
                  defaultValue={filters.statusCode}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="from">From</FieldLabel>
                <Input
                  key={defaultFrom}
                  id="from"
                  name="from"
                  type="datetime-local"
                  defaultValue={toLocalInput(filters.from ?? defaultFrom)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="to">To</FieldLabel>
                <Input id="to" name="to" type="datetime-local" defaultValue={toLocalInput(filters.to)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="requestId">Request ID</FieldLabel>
                <Input
                  id="requestId"
                  name="requestId"
                  defaultValue={filters.requestId}
                  placeholder="req_..."
                />
              </Field>
            </FieldGroup>
            <div>
              <Button type="submit">
                <SearchIcon data-icon="inline-start" />
                Apply filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs.data?.items ?? []).map((log) => (
                  <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelected(log)}>
                    <TableCell className="whitespace-nowrap">{formatDate(log.timestamp)}</TableCell>
                    <TableCell>
                      <StatusBadge value={log.level} />
                    </TableCell>
                    <TableCell>
                      {log.serviceName}
                      <div className="text-xs text-muted-foreground">{log.environment}</div>
                    </TableCell>
                    <TableCell>{log.sourceType}</TableCell>
                    <TableCell className="max-w-xl truncate font-mono text-xs">{log.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!logs.isLoading && !logs.data?.items.length && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No logs match the current filters.
            </p>
          )}
          <div className="mt-4">
            <PaginationControls
              page={logs.data?.page ?? page}
              limit={logs.data?.limit ?? 25}
              total={logs.data?.total ?? 0}
              onPage={setPage}
            />
          </div>
        </CardContent>
      </Card>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Log details</SheetTitle>
            <SheetDescription>
              {selected ? `${selected.serviceName} · ${formatDate(selected.timestamp)}` : 'Raw log payload'}
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="flex flex-col gap-5 px-4 pb-6">
              <div className="flex gap-2">
                <StatusBadge value={selected.level} />
                <StatusBadge value={selected.sourceType} />
              </div>
              <section>
                <h3 className="mb-1 text-sm font-medium">Message</h3>
                <CodeBlock code={selected.message} label="message" />
              </section>
              {selected.stackTrace && (
                <section>
                  <h3 className="mb-1 text-sm font-medium">Stack trace</h3>
                  <CodeBlock code={selected.stackTrace} label="stack trace" />
                </section>
              )}
              {selected.requestId && (
                <section>
                  <h3 className="mb-2 text-sm font-medium">Request ID</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-md bg-muted px-3 py-2 text-xs">{selected.requestId}</code>
                    <Button
                      size="icon"
                      variant="outline"
                      title="Copy request ID"
                      onClick={() => void copyText(selected.requestId!, 'Request ID copied')}
                    >
                      <CopyIcon />
                      <span className="sr-only">Copy request ID</span>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/logs${queryString({ requestId: selected.requestId })}`}>
                        <ListFilterIcon data-icon="inline-start" />
                        Related logs
                      </Link>
                    </Button>
                  </div>
                </section>
              )}
              <section>
                <h3 className="mb-1 text-sm font-medium">Payload</h3>
                <CodeBlock
                  label="payload"
                  code={JSON.stringify(
                    {
                      requestId: selected.requestId,
                      api: selected.api,
                      frontend: selected.frontend,
                      metadata: selected.metadata,
                    },
                    null,
                    2,
                  )}
                />
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function initialFilters(): Filters {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(
    [
      'keyword',
      'sourceType',
      'level',
      'environment',
      'serviceId',
      'from',
      'to',
      'path',
      'statusCode',
      'requestId',
    ]
      .map((key) => [key, params.get(key) ?? ''])
      .filter(([, value]) => value),
  );
}

function toLocalInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function copyText(value: string, message: string) {
  await navigator.clipboard.writeText(value);
  toast.success(message);
}
