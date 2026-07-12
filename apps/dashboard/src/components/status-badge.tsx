import { Badge } from "@/components/ui/badge"

export function StatusBadge({ value }: { value?: string }) {
  const normalized = value?.toLowerCase() ?? "unknown"
  const variant = ["critical", "fatal", "error"].includes(normalized) ? "destructive" : ["healthy", "resolved", "info"].includes(normalized) ? "default" : ["warning", "high", "medium", "acknowledged", "warn"].includes(normalized) ? "secondary" : "outline"
  return <Badge variant={variant}>{normalized}</Badge>
}
