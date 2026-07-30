'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ActivityIcon,
  BoxesIcon,
  CircleAlertIcon,
  RadioTowerIcon,
  RefreshCwIcon,
  SirenIcon,
} from 'lucide-react';
import { api, formatDate, queryString } from '@/lib/api';
import type { DashboardSummary, Service } from '@/lib/types';
import { useProject } from '@/components/project-context';
import { useTimeRange } from '@/components/time-range-context';
import { OnboardingChecklist } from '@/components/onboarding-checklist';
import { ErrorState, PageHeader, PageLoading, ProjectRequired } from '@/components/page-state';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const chartConfig = {
  errorCount: { label: 'Errors', color: 'var(--chart-2)' },
  count: { label: 'Logs', color: 'var(--chart-1)' },
  logsPerMinute: { label: 'Logs/min', color: 'var(--chart-1)' },
  errorRate: { label: 'Error rate', color: 'var(--chart-2)' },
  avgApiDurationMs: { label: 'API latency', color: 'var(--chart-3)' },
  incidentCount: { label: 'Incidents', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const SOURCE_LABELS: Record<string, string> = {
  docker: 'Docker',
  api: 'API',
  frontend: 'Frontend',
  worker: 'Worker',
  manual: 'Manual',
};

export default function OverviewPage() {
  const router = useRouter();
  const { projectId, loading } = useProject();
  const { range } = useTimeRange();
  const summary = useQuery({
    queryKey: ['dashboard', 'summary', projectId, range],
    queryFn: () => api<DashboardSummary>(`/dashboard/summary${queryString({ projectId, range })}`),
    enabled: Boolean(projectId),
    refetchInterval: 30_000,
  });
  const health = useQuery({
    queryKey: ['dashboard', 'health', projectId, range],
    queryFn: () => api<Service[]>(`/dashboard/services-health${queryString({ projectId, range })}`),
    enabled: Boolean(projectId),
    refetchInterval: 30_000,
  });
  if (loading) return <PageLoading />;
  if (!projectId) return <ProjectRequired />;
  if (summary.error) return <ErrorState error={summary.error} />;
  if (!summary.data) return <PageLoading />;

  const data = summary.data;
  const metrics = [
    { label: 'Services', value: data.totalServices, icon: BoxesIcon, href: '/services' },
    {
      label: 'Logs',
      value: data.totalLogs,
      icon: ActivityIcon,
      trend: data.trends.totalLogs,
      href: '/logs',
    },
    {
      label: 'Errors',
      value: data.errorLogs,
      icon: CircleAlertIcon,
      trend: data.trends.errorLogs,
      href: `/logs${queryString({ level: 'error' })}`,
    },
    {
      label: 'Open incidents',
      value: data.openIncidents,
      icon: SirenIcon,
      trend: data.trends.incidents,
      href: '/incidents',
    },
    {
      label: 'Critical',
      value: data.criticalIncidents,
      icon: RadioTowerIcon,
      href: '/incidents?severity=CRITICAL',
    },
  ];
  const sourceData = Object.entries(data.sourceCounts).map(([source, count]) => ({
    source,
    label: SOURCE_LABELS[source] ?? source,
    count,
  }));

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Operational state for the last ${range}.`}
        action={
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Updated {formatUpdatedAt(summary.dataUpdatedAt)}
            </span>
            <Button
              size="icon"
              variant="outline"
              title="Refresh dashboard"
              onClick={() => void Promise.all([summary.refetch(), health.refetch()])}
              disabled={summary.isFetching || health.isFetching}
            >
              <RefreshCwIcon className={summary.isFetching ? 'animate-spin' : undefined} />
              <span className="sr-only">Refresh dashboard</span>
            </Button>
          </div>
        }
      />
      <OnboardingChecklist />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(({ label, value, icon: Icon, trend, href }) => (
          <Link key={label} href={href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="flex-row items-center justify-between">
                <CardDescription>{label}</CardDescription>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="flex items-end justify-between gap-2">
                <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
                {trend !== undefined && <TrendBadge value={trend} />}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Log volume and error rate</CardTitle>
            <CardDescription>Throughput normalized per minute and percentage of errors.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-72 w-full">
              <LineChart accessibilityLayer data={data.timeSeries}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: string) => formatChartTime(value, range)}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API latency and incidents</CardTitle>
            <CardDescription>Average request duration and newly detected incidents.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-72 w-full">
              <LineChart accessibilityLayer data={data.timeSeries}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: string) => formatChartTime(value, range)}
                />
                <YAxis yAxisId="latency" tickLine={false} axisLine={false} width={48} />
                <YAxis
                  yAxisId="incidents"
                  orientation="right"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <ChartTooltip
                  content={<ChartTooltipContent labelFormatter={(value) => formatDate(String(value))} />}
                />
                <Line
                  yAxisId="latency"
                  dataKey="avgApiDurationMs"
                  stroke="var(--color-avgApiDurationMs)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  yAxisId="incidents"
                  dataKey="incidentCount"
                  stroke="var(--color-incidentCount)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top error services</CardTitle>
            <CardDescription>Click a bar to inspect the service logs.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topErrorServices.length ? (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart
                  accessibilityLayer
                  data={data.topErrorServices}
                  layout="vertical"
                  margin={{ left: 12 }}
                >
                  <CartesianGrid horizontal={false} />
                  <YAxis
                    dataKey="serviceName"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <XAxis type="number" hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="errorCount"
                    fill="var(--color-errorCount)"
                    radius={4}
                    className="cursor-pointer"
                    onClick={(row) =>
                      router.push(`/logs${queryString({ serviceId: row.payload?.serviceId })}`)
                    }
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmpty title="No errors" description="No error logs were recorded in this range." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Log sources</CardTitle>
            <CardDescription>Click a bar to filter logs by source.</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceData.some((item) => item.count > 0) ? (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart accessibilityLayer data={sourceData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={42} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={4}
                    className="cursor-pointer"
                    onClick={(row) => router.push(`/logs${queryString({ sourceType: row.payload?.source })}`)}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <ChartEmpty title="No logs" description="No logs were recorded in this range." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Slowest API endpoints</CardTitle>
          <CardDescription>Latency percentiles expose slow-tail requests hidden by averages.</CardDescription>
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
                {data.slowestApiEndpoints.map((endpoint) => (
                  <TableRow key={`${endpoint.method}:${endpoint.path}`}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/logs${queryString({ sourceType: 'api', path: endpoint.path })}`}
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
          {!data.slowestApiEndpoints.length && (
            <ChartEmpty title="No API timings" description="API logs with durationMs will appear here." />
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Service health</CardTitle>
            <CardDescription>Health includes inactivity, error rate, and open incidents.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Error rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(health.data ?? []).slice(0, 6).map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`/services/${service.id}`}>
                        {service.name}
                      </Link>
                      <div className="max-w-64 truncate text-xs text-muted-foreground">{service.reason}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={service.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{service.errorRate ?? 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!health.data?.length && (
              <ChartEmpty title="No services" description="No services have registered yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent incidents</CardTitle>
            <CardDescription>Latest fingerprint groups requiring attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Incident</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentIncidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`/incidents/${incident.id}`}>
                        {incident.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{incident.serviceName}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={incident.severity} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={incident.status} />
                    </TableCell>
                    <TableCell>{formatDate(incident.lastSeenAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!data.recentIncidents.length && (
              <ChartEmpty title="No incidents" description="No incidents have been detected." />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function TrendBadge({ value }: { value: number | null }) {
  return (
    <Badge variant="outline" title="Compared with the previous equivalent range">
      {value === null ? 'New' : `${value > 0 ? '+' : ''}${value}%`}
    </Badge>
  );
}

function ChartEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="min-h-52">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function formatUpdatedAt(timestamp: number) {
  return new Intl.DateTimeFormat('en', { timeStyle: 'medium' }).format(timestamp);
}

function formatChartTime(value: string, range: string) {
  return new Intl.DateTimeFormat('en', {
    ...(range === '7d' ? { weekday: 'short' as const } : { hour: '2-digit', minute: '2-digit' }),
  }).format(new Date(value));
}
