import { maskSensitiveData, DEFAULT_MASK_FIELDS } from './mask';

type HeaderValue = string | string[] | number | undefined;

export type LogMindRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: Record<string, HeaderValue>;
  ip?: string;
  socket?: { remoteAddress?: string };
  body?: unknown;
};

export type LogMindResponse = {
  statusCode?: number;
  statusMessage?: string;
  locals?: Record<string, unknown>;
  getHeader?(name: string): HeaderValue;
  on(event: 'finish', listener: () => void): unknown;
};

export type LogMindNext = () => void;

export type LogMindApiLoggerOptions = {
  apiKey?: string;
  serviceName: string;
  environment: string;
  endpoint: string;
  maskFields?: string[];
  captureRequestBody?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type LogMindPayload = {
  sourceType: 'api';
  serviceName: string;
  environment: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  requestId?: string;
  api: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    requestId?: string;
    ip?: string;
    userAgent?: string;
    errorMessage?: string;
  };
  metadata?: Record<string, unknown>;
};

export function logmindApiLogger(options: LogMindApiLoggerOptions) {
  const maskFields = options.maskFields ?? DEFAULT_MASK_FIELDS;

  return (req: LogMindRequest, res: LogMindResponse, next: LogMindNext) => {
    const startedAt = Date.now();

    res.on('finish', () => {
      if (!options.apiKey || !options.endpoint) return;

      const payload = buildLogPayload(options, req, res, startedAt, maskFields);
      void sendLog(options, payload).catch(() => undefined);
    });

    next();
  };
}

export function buildLogPayload(
  options: LogMindApiLoggerOptions,
  req: LogMindRequest,
  res: LogMindResponse,
  startedAt: number,
  maskFields = options.maskFields ?? DEFAULT_MASK_FIELDS,
): LogMindPayload {
  const statusCode = res.statusCode ?? 0;
  const method = req.method ?? 'GET';
  const path = req.originalUrl ?? req.url ?? '/';
  const requestId = header(req.headers, 'x-request-id') ?? headerFromResponse(res, 'x-request-id');
  const errorMessage = extractErrorMessage(res);
  const api = {
    method,
    path,
    statusCode,
    durationMs: Date.now() - startedAt,
    requestId,
    ip: req.ip ?? firstForwardedFor(req.headers) ?? req.socket?.remoteAddress,
    userAgent: header(req.headers, 'user-agent'),
    errorMessage,
  };
  const metadata =
    options.captureRequestBody && req.body !== undefined
      ? { requestBody: maskSensitiveData(req.body, maskFields) }
      : undefined;

  return {
    sourceType: 'api',
    serviceName: options.serviceName,
    environment: options.environment,
    level: levelForStatus(statusCode),
    message: errorMessage
      ? `${method} ${path} failed with ${statusCode}: ${errorMessage}`
      : `${method} ${path} responded ${statusCode}`,
    timestamp: new Date().toISOString(),
    requestId,
    api,
    metadata,
  };
}

export function levelForStatus(statusCode: number): 'info' | 'warn' | 'error' {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
}

export async function sendLog(options: LogMindApiLoggerOptions, payload: LogMindPayload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 1500);

  try {
    await (options.fetchImpl ?? fetch)(options.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey ?? '',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function header(headers: LogMindRequest['headers'], name: string) {
  const value = headers?.[name.toLowerCase()] ?? headers?.[name];
  return Array.isArray(value) ? value[0] : value === undefined ? undefined : String(value);
}

function headerFromResponse(res: LogMindResponse, name: string) {
  const value = res.getHeader?.(name);
  return Array.isArray(value) ? value[0] : value === undefined ? undefined : String(value);
}

function firstForwardedFor(headers: LogMindRequest['headers']) {
  return header(headers, 'x-forwarded-for')?.split(',')[0]?.trim();
}

function extractErrorMessage(res: LogMindResponse) {
  const error = res.locals?.error;
  const message =
    res.locals?.errorMessage ??
    (error instanceof Error ? error.message : undefined) ??
    (typeof error === 'string' ? error : undefined);

  return message === undefined ? undefined : String(message);
}
