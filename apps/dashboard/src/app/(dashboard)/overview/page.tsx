"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ActivityIcon,
  BoxesIcon,
  CircleAlertIcon,
  ContainerIcon,
  RadioTowerIcon,
  SirenIcon,
} from "lucide-react";
import { api, formatDate, queryString } from "@/lib/api";
import type { DashboardSummary, Service } from "@/lib/types";
import { useProject } from "@/components/project-context";
import {
  ErrorState,
  PageHeader,
  PageLoading,
  ProjectRequired,
} from "@/components/page-state";
import { StatusBadge } from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const chartConfig = {
  errorCount: { label: "Errors", color: "var(--chart-2)" },
} satisfies ChartConfig;

export default function OverviewPage() {
  const { projectId, loading } = useProject();
  const summary = useQuery({
    queryKey: ["dashboard", "summary", projectId],
    queryFn: () =>
      api<DashboardSummary>(`/dashboard/summary${queryString({ projectId })}`),
    enabled: Boolean(projectId),
    refetchInterval: 30_000,
  });
  const health = useQuery({
    queryKey: ["dashboard", "health", projectId],
    queryFn: () =>
      api<Service[]>(`/dashboard/services-health${queryString({ projectId })}`),
    enabled: Boolean(projectId),
    refetchInterval: 30_000,
  });
  if (loading) return <PageLoading />;
  if (!projectId) return <ProjectRequired />;
  if (summary.error) return <ErrorState error={summary.error} />;
  if (!summary.data) return <PageLoading />;
  const data = summary.data;
  const metrics = [
    { label: "Services", value: data.totalServices, icon: BoxesIcon },
    { label: "Logs today", value: data.totalLogsToday, icon: ActivityIcon },
    {
      label: "Errors today",
      value: data.errorLogsToday,
      icon: CircleAlertIcon,
    },
    { label: "Open incidents", value: data.openIncidents, icon: SirenIcon },
    { label: "Critical", value: data.criticalIncidents, icon: RadioTowerIcon },
    { label: "Docker logs", value: data.dockerLogsToday, icon: ContainerIcon },
  ];
  return (
    <>
      <PageHeader
        title="Overview"
        description="Current operational state for the selected project."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between">
              <CardDescription>{label}</CardDescription>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top error services</CardTitle>
            <CardDescription>Error volume since midnight.</CardDescription>
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
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-20 text-center text-sm text-muted-foreground">
                No errors today.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Service health</CardTitle>
            <CardDescription>Updated every 30 seconds.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(health.data ?? []).slice(0, 6).map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/logs?serviceId=${service.id}`}
                      >
                        {service.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {service.environment}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={service.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {service.errorCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!health.data?.length && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No services registered yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent incidents</CardTitle>
          <CardDescription>
            Latest fingerprint groups requiring attention.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentIncidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell>
                    <Link
                      className="font-medium hover:underline"
                      href={`/incidents/${incident.id}`}
                    >
                      {incident.title}
                    </Link>
                  </TableCell>
                  <TableCell>{incident.serviceName}</TableCell>
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
            <p className="py-12 text-center text-sm text-muted-foreground">
              No incidents detected.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
