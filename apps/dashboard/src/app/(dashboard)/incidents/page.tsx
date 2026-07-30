'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, CircleCheckBigIcon, FilterIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api, formatDate, queryString } from '@/lib/api';
import type { Incident, Page, Service } from '@/lib/types';
import { deniedReason } from '@/lib/permissions';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function IncidentsPage() {
  const { projectId, loading, can } = useProject();
  const { range } = useTimeRange();
  const client = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  const [page, setPage] = useState(1);
  const defaultFrom = useMemo(() => rangeStart(range), [range]);
  const effectiveFilters = filters.from ? filters : { ...filters, from: defaultFrom };
  const services = useQuery({
    queryKey: ['services', projectId],
    queryFn: () => api<Service[]>(`/projects/${projectId}/services`),
    enabled: Boolean(projectId),
  });
  const incidents = useQuery({
    queryKey: ['incidents', projectId, effectiveFilters, page],
    queryFn: () =>
      api<Page<Incident>>(`/incidents${queryString({ projectId, ...effectiveFilters, page, limit: 25 })}`),
    enabled: Boolean(projectId),
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: Incident['status'] }) =>
      api(`/incidents/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: value }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['incidents', projectId] });
      await client.invalidateQueries({ queryKey: ['dashboard', 'summary', projectId] });
      toast.success('Incident status updated');
    },
    onError: (error) => toast.error(error.message),
  });
  // Live feed: the worker publishes on every detection, so the table refreshes itself
  // instead of the operator hitting reload during an outage.
  const { connected } = useProjectEvents(projectId, () => {
    void client.invalidateQueries({ queryKey: ['incidents', projectId] });
  });
  if (loading) return <PageLoading />;
  if (!projectId) return <ProjectRequired />;
  if (incidents.error) return <ErrorState error={incidents.error} />;
  return (
    <>
      <PageHeader
        title="Incidents"
        description={`Fingerprint groups active within the last ${range}.`}
        action={<LiveIndicator live connected={connected} />}
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
                    value === 'all' ? '' : String(value),
                  ]),
                ),
              );
              setPage(1);
            }}
          >
            <FieldGroup className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select name="status" defaultValue={filters.status || 'all'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {['all', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Severity</FieldLabel>
                <Select name="severity" defaultValue={filters.severity || 'all'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {['all', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Service</FieldLabel>
                <Select name="serviceId" defaultValue={filters.serviceId || 'all'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All services</SelectItem>
                      {(services.data ?? []).map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <div>
              <Button type="submit">
                <FilterIcon data-icon="inline-start" />
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
                  <TableHead>Incident</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Occurrences</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(incidents.data?.items ?? []).map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`/incidents/${incident.id}`}>
                        {incident.title}
                      </Link>
                    </TableCell>
                    <TableCell>{incident.service.name}</TableCell>
                    <TableCell>
                      <StatusBadge value={incident.severity} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={incident.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{incident.occurrenceCount}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(incident.lastSeenAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {incident.status === 'OPEN' && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title={
                              can('changeIncidentStatus')
                                ? 'Acknowledge incident'
                                : deniedReason('changeIncidentStatus')
                            }
                            disabled={!can('changeIncidentStatus') || status.isPending}
                            onClick={() => status.mutate({ id: incident.id, value: 'ACKNOWLEDGED' })}
                          >
                            <CheckIcon />
                            <span className="sr-only">Acknowledge incident</span>
                          </Button>
                        )}
                        {incident.status !== 'RESOLVED' && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title={
                              can('changeIncidentStatus')
                                ? 'Resolve incident'
                                : deniedReason('changeIncidentStatus')
                            }
                            disabled={!can('changeIncidentStatus') || status.isPending}
                            onClick={() => status.mutate({ id: incident.id, value: 'RESOLVED' })}
                          >
                            <CircleCheckBigIcon />
                            <span className="sr-only">Resolve incident</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!incidents.isLoading && !incidents.data?.items.length && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No incidents match the current filters.
            </p>
          )}
          <div className="mt-4">
            <PaginationControls
              page={incidents.data?.page ?? page}
              limit={incidents.data?.limit ?? 25}
              total={incidents.data?.total ?? 0}
              onPage={setPage}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function initialFilters() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(
    ['status', 'severity', 'serviceId']
      .map((key) => [key, params.get(key) ?? ''])
      .filter(([, value]) => value),
  );
}
