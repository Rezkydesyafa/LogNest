"use client"

import { use, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BrainCircuitIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"
import { api, formatDate, queryString } from "@/lib/api"
import type { Incident, Log, Page } from "@/lib/types"
import { ErrorState, PageHeader, PageLoading } from "@/components/page-state"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const [logPage] = useState(1)
  const incident = useQuery({ queryKey: ["incident", id], queryFn: () => api<Incident>(`/incidents/${id}`) })
  const logs = useQuery({ queryKey: ["incident", id, "logs", logPage], queryFn: () => api<Page<Log>>(`/incidents/${id}/logs${queryString({ page: logPage, limit: 25 })}`) })
  const status = useMutation({
    mutationFn: (value: string) => api<Incident>(`/incidents/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: value }) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["incident", id] }); await queryClient.invalidateQueries({ queryKey: ["incidents"] }); toast.success("Incident status updated") },
    onError: (error) => toast.error(error.message),
  })
  const analyze = useMutation({
    mutationFn: () => api(`/incidents/${id}/analyze`, { method: "POST" }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["incident", id] }); toast.success("AI analysis completed") },
    onError: (error) => toast.error(error.message),
  })
  if (incident.isLoading) return <PageLoading />
  if (incident.error) return <ErrorState error={incident.error} />
  if (!incident.data) return null
  const item = incident.data
  return <><PageHeader title={item.title} description={`${item.service.name} · ${item.service.environment}`} action={<div className="flex items-center gap-2"><StatusBadge value={item.severity} /><Select value={item.status} onValueChange={(value) => status.mutate(value)} disabled={status.isPending}><SelectTrigger aria-label="Incident status" className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{["OPEN", "ACKNOWLEDGED", "RESOLVED"].map((value) => <SelectItem key={value} value={value}>{value.toLowerCase()}</SelectItem>)}</SelectGroup></SelectContent></Select></div>} />
    <div className="mb-6 grid gap-4 sm:grid-cols-3"><Card><CardHeader><CardDescription>Occurrences</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{item.occurrenceCount}</p></CardContent></Card><Card><CardHeader><CardDescription>First seen</CardDescription></CardHeader><CardContent><p className="text-sm font-medium">{formatDate(item.firstSeenAt)}</p></CardContent></Card><Card><CardHeader><CardDescription>Last seen</CardDescription></CardHeader><CardContent><p className="text-sm font-medium">{formatDate(item.lastSeenAt)}</p></CardContent></Card></div>
    <Tabs defaultValue="analysis"><TabsList><TabsTrigger value="analysis">AI analysis</TabsTrigger><TabsTrigger value="logs">Related logs</TabsTrigger><TabsTrigger value="timeline">Timeline</TabsTrigger></TabsList>
      <TabsContent value="analysis"><Card><CardHeader><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><CardTitle>Incident analysis</CardTitle><CardDescription>{item.aiLastAnalyzedAt ? `Last analyzed ${formatDate(item.aiLastAnalyzedAt)}` : "Generate a structured incident summary."}</CardDescription></div><Button onClick={() => analyze.mutate()} disabled={analyze.isPending}>{analyze.isPending ? <Spinner data-icon="inline-start" /> : item.aiSummary ? <RefreshCwIcon data-icon="inline-start" /> : <BrainCircuitIcon data-icon="inline-start" />}{item.aiSummary ? "Refresh analysis" : "Analyze incident"}</Button></div></CardHeader><CardContent>{item.aiSummary ? <div className="grid gap-6 lg:grid-cols-2"><section><h3 className="mb-2 font-medium">Summary</h3><p className="text-sm text-muted-foreground">{item.aiSummary}</p></section><section><h3 className="mb-2 font-medium">Possible cause</h3><p className="text-sm text-muted-foreground">{item.aiPossibleCause}</p></section><section><h3 className="mb-2 font-medium">Impact</h3><p className="text-sm text-muted-foreground">{item.aiImpact}</p></section><section><h3 className="mb-2 font-medium">Suggested actions</h3><ol className="list-decimal pl-5 text-sm text-muted-foreground">{item.aiSuggestedActions.map((action) => <li key={action}>{action}</li>)}</ol></section></div> : <p className="py-16 text-center text-sm text-muted-foreground">No AI analysis generated yet.</p>}</CardContent></Card></TabsContent>
      <TabsContent value="logs"><Card><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Level</TableHead><TableHead>Message</TableHead></TableRow></TableHeader><TableBody>{(logs.data?.items ?? []).map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap">{formatDate(log.timestamp)}</TableCell><TableCell><StatusBadge value={log.level} /></TableCell><TableCell className="max-w-2xl font-mono text-xs">{log.message}</TableCell></TableRow>)}</TableBody></Table></div>{!logs.data?.items.length && <p className="py-16 text-center text-sm text-muted-foreground">No related raw logs found.</p>}</CardContent></Card></TabsContent>
      <TabsContent value="timeline"><Card><CardHeader><CardTitle>Timeline</CardTitle><CardDescription>Incident lifecycle events.</CardDescription></CardHeader><CardContent><ol className="flex flex-col gap-4">{item.events.map((event) => <li key={event.id} className="border-l pl-4"><p className="text-sm font-medium">{event.message}</p><p className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</p></li>)}</ol></CardContent></Card></TabsContent>
    </Tabs>
  </>
}
