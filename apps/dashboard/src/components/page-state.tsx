import { FolderPlusIcon, TriangleAlertIcon } from "lucide-react"
import { CreateProjectDialog } from "@/components/project-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

export function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h1 className="text-2xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">{description}</p></div>{action}</div>
}

export function ProjectRequired() {
  return <Empty className="min-h-96 border"><EmptyHeader><EmptyMedia variant="icon"><FolderPlusIcon /></EmptyMedia><EmptyTitle>Create your first project</EmptyTitle><EmptyDescription>A project connects services, API keys, logs, and incidents.</EmptyDescription></EmptyHeader><EmptyContent><CreateProjectDialog /></EmptyContent></Empty>
}

export function PageLoading() {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}</div>
}

export function ErrorState({ error }: { error: Error }) {
  return <Alert variant="destructive"><TriangleAlertIcon /><AlertTitle>Unable to load data</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>
}
