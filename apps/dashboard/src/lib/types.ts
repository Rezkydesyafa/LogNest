import type { ProjectRole } from './permissions';

export type User = { id: string; email: string; name: string | null };
export type Project = {
  id: string;
  name: string;
  description?: string;
  timezone?: string;
  /** Role the current user holds in this project. Drives which actions the UI offers. */
  role?: ProjectRole;
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
  periodLogCount?: number;
  periodErrorCount?: number;
  errorRate?: number;
  reason?: string;
  openIncidentCount?: number;
  criticalIncidentCount?: number;
  status?: 'healthy' | 'warning' | 'critical' | 'stale';
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
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  occurrenceCount: number;
  recentCount: number;
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
  type: 'SERVER' | 'CLIENT';
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
export type DashboardRange = '15m' | '1h' | '6h' | '24h' | '7d';
export type DashboardRangeInfo = {
  key: DashboardRange;
  from: string;
  to: string;
  bucketMinutes: number;
};
export type DashboardTimePoint = {
  timestamp: string;
  logCount: number;
  logsPerMinute: number;
  errorCount: number;
  errorRate: number;
  incidentCount: number;
  avgApiDurationMs: number | null;
};
export type ApiPerformanceEndpoint = {
  path: string;
  method: string;
  count: number;
  avgDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  maxDurationMs: number;
  errorCount: number;
};
export type DashboardSummary = {
  range: DashboardRangeInfo;
  totalServices: number;
  totalLogs: number;
  dockerLogs: number;
  apiLogs: number;
  frontendLogs: number;
  workerLogs: number;
  manualLogs: number;
  errorLogs: number;
  openIncidents: number;
  criticalIncidents: number;
  sourceCounts: Record<string, number>;
  trends: {
    totalLogs: number | null;
    errorLogs: number | null;
    incidents: number | null;
  };
  timeSeries: DashboardTimePoint[];
  topErrorServices: Array<{
    serviceId: string;
    serviceName: string;
    errorCount: number;
  }>;
  slowestApiEndpoints: ApiPerformanceEndpoint[];
  recentIncidents: Array<
    Pick<Incident, 'id' | 'title' | 'severity' | 'status' | 'lastSeenAt'> & {
      serviceName: string;
    }
  >;
};
export type ServiceDetail = {
  range: DashboardRangeInfo;
  service: Service;
  sourceCounts: Record<string, number>;
  timeSeries: DashboardTimePoint[];
  apiPerformance: ApiPerformanceEndpoint[];
  recentIncidents: Incident[];
  recentLogs: Log[];
};

export type AlertChannel = {
  id: string;
  projectId: string;
  name: string;
  type: 'SLACK' | 'DISCORD' | 'TELEGRAM' | 'WEBHOOK';
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
};
export type AlertRule = {
  id: string;
  projectId: string;
  channelId: string;
  name: string;
  enabled: boolean;
  minSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  serviceIds: string[];
  environments: string[];
  onCreated: boolean;
  onSeverityIncrease: boolean;
  onReopened: boolean;
  throttleMinutes: number;
  createdAt: string;
  channel?: Pick<AlertChannel, 'id' | 'name' | 'type' | 'enabled'>;
};
export type AlertDelivery = {
  id: string;
  ruleId: string;
  incidentId: string;
  trigger: 'CREATED' | 'SEVERITY_INCREASED' | 'REOPENED';
  status: 'SENT' | 'FAILED' | 'THROTTLED';
  error?: string;
  createdAt: string;
  rule?: { id: string; name: string };
};

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  role: 'VIEWER' | 'MEMBER' | 'ADMIN' | 'OWNER';
  createdAt: string;
  user: { id: string; email: string; name: string | null };
};
export type AuditLog = {
  id: string;
  projectId: string | null;
  userId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};
