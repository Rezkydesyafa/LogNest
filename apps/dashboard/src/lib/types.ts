export type User = { id: string; email: string; name: string | null };
export type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
};
export type Service = {
  id: string;
  projectId: string;
  name: string;
  environment: string;
  sourceTypes: string[];
  lastSeenAt: string;
  logCount: number;
  errorCount: number;
  openIncidentCount?: number;
  criticalIncidentCount?: number;
  status?: "healthy" | "warning" | "critical" | "stale";
};
export type Log = {
  id: string;
  serviceId: string;
  sourceType: string;
  serviceName: string;
  environment: string;
  level: string;
  message: string;
  timestamp: string;
  requestId?: string;
  api?: Record<string, unknown>;
  frontend?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
};
export type IncidentEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};
export type Incident = {
  id: string;
  projectId: string;
  serviceId: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  service: Service;
  events: IncidentEvent[];
  aiSummary?: string;
  aiPossibleCause?: string;
  aiImpact?: string;
  aiSuggestedActions: string[];
  aiConfidence?: string;
  aiLastAnalyzedAt?: string;
  aiError?: string;
};
export type ApiKey = {
  id: string;
  name: string;
  type: "SERVER" | "CLIENT";
  prefix: string;
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: string;
  key?: string;
};
export type Page<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};
export type DashboardSummary = {
  totalServices: number;
  totalLogsToday: number;
  dockerLogsToday: number;
  apiLogsToday: number;
  frontendLogsToday: number;
  errorLogsToday: number;
  openIncidents: number;
  criticalIncidents: number;
  topErrorServices: Array<{
    serviceId: string;
    serviceName: string;
    errorCount: number;
  }>;
  slowestApiEndpoints: Array<{
    path: string;
    method: string;
    avgDurationMs: number;
    errorCount: number;
  }>;
  recentIncidents: Array<
    Pick<Incident, "id" | "title" | "severity" | "status" | "lastSeenAt"> & {
      serviceName: string;
    }
  >;
};
