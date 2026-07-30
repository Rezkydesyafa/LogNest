'use client';

import Link from 'next/link';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { ActivityIcon, CircleAlertIcon, GaugeIcon, RefreshCwIcon, SirenIcon } from 'lucide-react';
import { api, formatDate, queryString } from '@/lib/api';
import type { ServiceDetail } from '@/lib/types';
import { useProject } from '@/components/project-context';
import { useTimeRange } from '@/components/time-range-context';
import { ErrorState, PageHeader, PageLoading, ProjectRequired } from '@/components/page-state';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const chartConfig = {
  logsPerMinute: { label: 'Logs/min', color: 'var(--chart-1)' },
  errorRate: { label: 'Error rate', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export default function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { projectId, loading } = useProject();
  const { range } = useTimeRange();
  const query = useQuery({
    queryKey: ['dashboard', 'service', projectId, id, range],
    queryFn: () => api<ServiceDetail>(`/dashboard/services/${id}${queryString({ projectId, range })}`),
    enabled: Boolean(projectId),
    refetchInterval: 30_000,
  });

  if (loading) return <PageLoading />;
  if (!projectId) return <ProjectRequired />;
  if (query.error) return <ErrorState error={query.error} />;
  if (!query.data?.service) return <PageLoading />;

  const data = query.data;
  const service = data.service;
  const metrics = [
    { label: 'Logs', value: service.periodLogCount ?? 0, icon: ActivityIcon },
    { label: 'Errors', value: service.periodErrorCount ?? 0, icon: CircleAlertIcon },
    { label: 'Error rate', value: `${service.errorRate ?? 0}%`, icon: GaugeIcon },
    { label: 'Open incidents', value: service.openIncidentCount ?? 0, icon: SirenIcon },
  ];

  return (
    <>
      <PageHeader
        title={service.name}
        description={`${service.environment} · ${service.reason}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge value={service.status} />
            <Button
              size="icon"
              variant="outline"
              title="Refresh service"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCwIcon className={query.isFetching ? 'animate-spin' : undefined} />
              <span className="sr-only">Refresh service</span>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between">
              <CardDescription>{label}</CardDescription>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Service traffic</CardTitle>
            <CardDescription>Logs per minute and error rate over the last {range}.</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/logs${queryString({ serviceId: id })}`}>View all logs</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <LineChart accessibilityLayer data={data.timeSeries}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: string) =>
                  new Intl.DateTimeFormat('en', {
                    ...(range === '7d'
                      ? { weekday: 'short' as const }
                      : { hour: '2-digit', minute: '2-digit' }),
                  }).format(new Date(value))
                }
              />
              <YAxis yAxisId="volume" tickLine={false} axisLine={false} width={42} />
              <YAxis
                yAxisId="rate"
                orientation="right"
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                width={42}
                tickFormatter={(value) => `${value}%`}
              />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(value) => formatDate(String(value))} />}
              />
              <Line
                yAxisId="volume"
                dataKey="logsPerMinute"
                stroke="var(--color-logsPerMinute)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="rate"
                dataKey="errorRate"
                stroke="var(--color-errorRate)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(data.sourceCounts).map(([source, count]) => (
              <Badge key={source} variant="outline">
                {source}: {count.toLocaleString()}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>API performance</CardTitle>
          <CardDescription>Average and tail latency for this service.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">P95</TableHead>
                  <TableHead className="text-right">P99</TableHead>
                  <TableHead className="text-right">5xx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.apiPerformance.map((endpoint) => (
                  <TableRow key={`${endpoint.method}:${endpoint.path}`}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/logs${queryString({ serviceId: id, sourceType: 'api', path: endpoint.path })}`}
                      >
                        <span className="mr-2 text-xs text-muted-foreground">{endpoint.method}</span>
                        {endpoint.path}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{endpoint.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{endpoint.avgDurationMs} ms</TableCell>
                    <TableCell className="text-right tabular-nums">{endpoint.p95DurationMs} ms</TableCell>
                    <TableCell className="text-right tabular-nums">{endpoint.p99DurationMs} ms</TableCell>
                    <TableCell className="text-right tabular-nums">{endpoint.errorCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!data.apiPerformance.length && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No API timing data in this range.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent incidents</CardTitle>
            <CardDescription>Latest incidents associated with this service.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Incident</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentIncidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`/incidents/${incident.id}`}>
                        {incident.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{formatDate(incident.lastSeenAt)}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={incident.severity} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={incident.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!data.recentIncidents.length && (
              <p className="py-12 text-center text-sm text-muted-foreground">No incidents detected.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent logs</CardTitle>
            <CardDescription>Latest raw logs received from this service.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(log.timestamp)}</TableCell>
                    <TableCell>
                      <StatusBadge value={log.level} />
                    </TableCell>
                    <TableCell className="max-w-80 truncate font-mono text-xs">{log.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!data.recentLogs.length && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No logs received in this range.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
