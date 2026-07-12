"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CopyIcon, KeyRoundIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { api, formatDate } from "@/lib/api"
import type { ApiKey } from "@/lib/types"
import { ErrorState, PageHeader, PageLoading, ProjectRequired } from "@/components/page-state"
import { useProject } from "@/components/project-context"
import { StatusBadge } from "@/components/status-badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function ApiKeysPage() {
  const { projectId, loading } = useProject()
  const client = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [created, setCreated] = useState<ApiKey>()
  const keys = useQuery({ queryKey: ["api-keys", projectId], queryFn: () => api<ApiKey[]>(`/projects/${projectId}/api-keys`), enabled: Boolean(projectId) })
  const create = useMutation({
    mutationFn: (input: { name: string; type: string }) => api<ApiKey>(`/projects/${projectId}/api-keys`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: async (key) => { setCreateOpen(false); setCreated(key); await client.invalidateQueries({ queryKey: ["api-keys", projectId] }); toast.success("API key created") },
    onError: (error) => toast.error(error.message),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["api-keys", projectId] }); toast.success("API key revoked") },
    onError: (error) => toast.error(error.message),
  })
  if (loading) return <PageLoading />
  if (!projectId) return <ProjectRequired />
  if (keys.error) return <ErrorState error={keys.error} />
  const createButton = <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogTrigger asChild><Button><PlusIcon data-icon="inline-start" />Create key</Button></DialogTrigger><DialogContent><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); create.mutate({ name: String(data.get("name")), type: String(data.get("type")) }) }}><DialogHeader><DialogTitle>Create API key</DialogTitle><DialogDescription>Server keys ingest backend logs. Client keys only ingest browser logs.</DialogDescription></DialogHeader><FieldGroup className="py-5"><Field><FieldLabel htmlFor="key-name">Name</FieldLabel><Input id="key-name" name="name" required minLength={2} /></Field><Field><FieldLabel>Type</FieldLabel><Select name="type" defaultValue="SERVER"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="SERVER">Server</SelectItem><SelectItem value="CLIENT">Client</SelectItem></SelectGroup></SelectContent></Select></Field></FieldGroup><DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending && <Spinner data-icon="inline-start" />}Create</Button></DialogFooter></form></DialogContent></Dialog>
  return <><PageHeader title="API Keys" description="Credentials used by agents, services, and browser SDKs." action={createButton} />
    <Card><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Prefix</TableHead><TableHead>Last used</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{(keys.data ?? []).map((key) => <TableRow key={key.id}><TableCell className="font-medium">{key.name}</TableCell><TableCell><StatusBadge value={key.type} /></TableCell><TableCell className="font-mono text-xs">{key.prefix}…</TableCell><TableCell>{formatDate(key.lastUsedAt)}</TableCell><TableCell><StatusBadge value={key.revokedAt ? "revoked" : "active"} /></TableCell><TableCell className="text-right">{!key.revokedAt && <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Revoke key"><Trash2Icon /><span className="sr-only">Revoke key</span></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Revoke this API key?</AlertDialogTitle><AlertDialogDescription>Clients using this key will immediately stop sending logs.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => revoke.mutate(key.id)}>Revoke</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</TableCell></TableRow>)}</TableBody></Table></div>{!keys.isLoading && !keys.data?.length && <div className="flex flex-col items-center gap-3 py-16 text-center"><KeyRoundIcon className="size-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">No API keys created yet.</p>{createButton}</div>}</CardContent></Card>
    <Dialog open={Boolean(created)} onOpenChange={(open) => !open && setCreated(undefined)}><DialogContent><DialogHeader><DialogTitle>Copy your API key</DialogTitle><DialogDescription>This raw key is shown once. Store it securely before closing.</DialogDescription></DialogHeader><div className="flex items-center gap-2"><Input readOnly value={created?.key ?? ""} className="font-mono text-xs" /><Button size="icon" variant="outline" title="Copy API key" onClick={async () => { await navigator.clipboard.writeText(created?.key ?? ""); toast.success("API key copied") }}><CopyIcon /><span className="sr-only">Copy API key</span></Button></div><DialogFooter><Button onClick={() => setCreated(undefined)}>Done</Button></DialogFooter></DialogContent></Dialog>
  </>
}
