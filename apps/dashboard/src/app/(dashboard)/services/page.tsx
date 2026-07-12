"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { api, formatDate, queryString } from "@/lib/api"
import type { Service } from "@/lib/types"
import { useProject } from "@/components/project-context"
import { ErrorState, PageHeader, PageLoading, ProjectRequired } from "@/components/page-state"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function ServicesPage() {
  const { projectId, loading } = useProject()
  const query = useQuery({ queryKey: ["dashboard", "health", projectId], queryFn: () => api<Service[]>(`/dashboard/services-health${queryString({ projectId })}`), enabled: Boolean(projectId), refetchInterval: 30_000 })
  if (loading) return <PageLoading />
  if (!projectId) return <ProjectRequired />
  if (query.error) return <ErrorState error={query.error} />
  return <><PageHeader title="Services" description="Auto-registered services and their current health." /><Card><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Status</TableHead><TableHead>Sources</TableHead><TableHead className="text-right">Logs</TableHead><TableHead className="text-right">Errors</TableHead><TableHead className="text-right">Incidents</TableHead><TableHead>Last seen</TableHead></TableRow></TableHeader><TableBody>{(query.data ?? []).map((service) => <TableRow key={service.id}><TableCell><Link className="font-medium hover:underline" href={`/logs?serviceId=${service.id}`}>{service.name}</Link><div className="text-xs text-muted-foreground">{service.environment}</div></TableCell><TableCell><StatusBadge value={service.status} /></TableCell><TableCell><div className="flex flex-wrap gap-1">{service.sourceTypes.map((source) => <Badge key={source} variant="outline">{source}</Badge>)}</div></TableCell><TableCell className="text-right tabular-nums">{service.logCount}</TableCell><TableCell className="text-right tabular-nums">{service.errorCount}</TableCell><TableCell className="text-right tabular-nums">{service.openIncidentCount}</TableCell><TableCell className="whitespace-nowrap">{formatDate(service.lastSeenAt)}</TableCell></TableRow>)}</TableBody></Table></div>{!query.isLoading && !query.data?.length && <p className="py-16 text-center text-sm text-muted-foreground">No services registered. Send a log with a server API key to get started.</p>}</CardContent></Card></>
}
