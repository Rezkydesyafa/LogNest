"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { SearchIcon } from "lucide-react"
import { api, formatDate, queryString } from "@/lib/api"
import type { Log, Page, Service } from "@/lib/types"
import { PaginationControls } from "@/components/pagination-controls"
import { ErrorState, PageHeader, PageLoading, ProjectRequired } from "@/components/page-state"
import { useProject } from "@/components/project-context"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Filters = { keyword?: string; sourceType?: string; level?: string; environment?: string; serviceId?: string; from?: string; to?: string; path?: string; statusCode?: string }

export default function LogsPage() {
  const { projectId, loading } = useProject()
  const initialService = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("serviceId") ?? ""
  const [filters, setFilters] = useState<Filters>({ serviceId: initialService })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Log>()
  const services = useQuery({ queryKey: ["services", projectId], queryFn: () => api<Service[]>(`/projects/${projectId}/services`), enabled: Boolean(projectId) })
  const logs = useQuery({ queryKey: ["logs", projectId, filters, page], queryFn: () => api<Page<Log>>(`/logs${queryString({ projectId, ...filters, statusCode: filters.statusCode ? Number(filters.statusCode) : undefined, page, limit: 25 })}`), enabled: Boolean(projectId) })

  if (loading) return <PageLoading />
  if (!projectId) return <ProjectRequired />
  if (logs.error) return <ErrorState error={logs.error} />
  return <><PageHeader title="Logs" description="Search raw Docker, API, worker, manual, and frontend logs." />
    <Card className="mb-5"><CardContent><form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setFilters(Object.fromEntries(Array.from(data.entries()).map(([key, value]) => [key, value === "all" ? "" : String(value)]))); setPage(1) }}>
      <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field><FieldLabel htmlFor="keyword">Search</FieldLabel><Input id="keyword" name="keyword" defaultValue={filters.keyword} placeholder="Message, stack, URL..." /></Field>
        <Field><FieldLabel>Service</FieldLabel><Select name="serviceId" defaultValue={filters.serviceId || "all"}><SelectTrigger><SelectValue placeholder="All services" /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All services</SelectItem>{(services.data ?? []).map((service) => <SelectItem key={service.id} value={service.id}>{service.name} · {service.environment}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
        <Field><FieldLabel>Source</FieldLabel><Select name="sourceType" defaultValue="all"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{["all", "docker", "api", "frontend", "worker", "manual"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
        <Field><FieldLabel>Level</FieldLabel><Select name="level" defaultValue="all"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{["all", "debug", "info", "warn", "error", "fatal"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
        <Field><FieldLabel htmlFor="environment">Environment</FieldLabel><Input id="environment" name="environment" placeholder="production" /></Field>
        <Field><FieldLabel htmlFor="path">API path</FieldLabel><Input id="path" name="path" placeholder="/checkout" /></Field>
        <Field><FieldLabel htmlFor="statusCode">Status code</FieldLabel><Input id="statusCode" name="statusCode" type="number" min="100" max="599" /></Field>
        <Field><FieldLabel htmlFor="from">From</FieldLabel><Input id="from" name="from" type="datetime-local" /></Field>
      </FieldGroup>
      <div><Button type="submit"><SearchIcon data-icon="inline-start" />Apply filters</Button></div>
    </form></CardContent></Card>
    <Card><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Level</TableHead><TableHead>Service</TableHead><TableHead>Source</TableHead><TableHead>Message</TableHead></TableRow></TableHeader><TableBody>{(logs.data?.items ?? []).map((log) => <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelected(log)}><TableCell className="whitespace-nowrap">{formatDate(log.timestamp)}</TableCell><TableCell><StatusBadge value={log.level} /></TableCell><TableCell>{log.serviceName}<div className="text-xs text-muted-foreground">{log.environment}</div></TableCell><TableCell>{log.sourceType}</TableCell><TableCell className="max-w-xl truncate font-mono text-xs">{log.message}</TableCell></TableRow>)}</TableBody></Table></div>{!logs.isLoading && !logs.data?.items.length && <p className="py-16 text-center text-sm text-muted-foreground">No logs match the current filters.</p>}<div className="mt-4"><PaginationControls page={logs.data?.page ?? page} limit={logs.data?.limit ?? 25} total={logs.data?.total ?? 0} onPage={setPage} /></div></CardContent></Card>
    <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(undefined)}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader><SheetTitle>Log details</SheetTitle><SheetDescription>{selected ? `${selected.serviceName} · ${formatDate(selected.timestamp)}` : "Raw log payload"}</SheetDescription></SheetHeader>{selected && <div className="flex flex-col gap-5 px-4 pb-6"><div className="flex gap-2"><StatusBadge value={selected.level} /><StatusBadge value={selected.sourceType} /></div><section><h3 className="mb-1 text-sm font-medium">Message</h3><pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{selected.message}</pre></section>{selected.stackTrace && <section><h3 className="mb-1 text-sm font-medium">Stack trace</h3><pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{selected.stackTrace}</pre></section>}<section><h3 className="mb-1 text-sm font-medium">Payload</h3><pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify({ requestId: selected.requestId, api: selected.api, frontend: selected.frontend, metadata: selected.metadata }, null, 2)}</pre></section></div>}</SheetContent></Sheet>
  </>
}
