import { setupBrowserListeners } from './browser-listeners';
import { setupFetchInstrumentation } from './fetch-instrumentation';
import { maskSensitiveData, DEFAULT_MASK_FIELDS } from './mask';

export type FrontendLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type FrontendLogPayload = {
  serviceName: string;
  environment: string;
  level: FrontendLogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  frontend?: Record<string, unknown>;
  api?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  stackTrace?: string;
};

export type LogMindFrontendOptions = {
  apiKey?: string;
  serviceName: string;
  environment: string;
  endpoint: string;
  maskFields?: string[];
  captureGlobalErrors?: boolean;
  instrumentFetch?: boolean;
  fetchImpl?: typeof fetch;
  windowRef?: Window;
};

export type LogMindFrontendClient = {
  captureError(error: unknown, metadata?: Record<string, unknown>): void;
  captureMessage(message: string, level?: FrontendLogLevel, metadata?: Record<string, unknown>): void;
  destroy(): void;
};

export function initLogMindFrontend(options: LogMindFrontendOptions): LogMindFrontendClient {
  const cleanups: Array<() => void> = [];
  const windowRef = options.windowRef ?? (typeof window === 'undefined' ? undefined : window);
  const send = (payload: Omit<FrontendLogPayload, 'serviceName' | 'environment' | 'timestamp' | 'frontend'>) =>
    sendFrontendLog(options, {
      ...payload,
      serviceName: options.serviceName,
      environment: options.environment,
      timestamp: new Date().toISOString(),
      frontend: browserMetadata(windowRef),
    });

  if (windowRef && options.captureGlobalErrors !== false) {
    cleanups.push(setupBrowserListeners(windowRef, send));
  }

  if (windowRef && options.instrumentFetch !== false) {
    cleanups.push(setupFetchInstrumentation(windowRef, send));
  }

  return {
    captureError(error, metadata) {
      send(errorPayload(error, metadata));
    },
    captureMessage(message, level = 'info', metadata) {
      send({
        level,
        message,
        metadata: cleanMetadata(metadata, options.maskFields),
      });
    },
    destroy() {
      cleanups.splice(0).forEach((cleanup) => cleanup());
    },
  };
}

export function errorPayload(error: unknown, metadata?: Record<string, unknown>) {
  const normalized = normalizeError(error);

  return {
    level: 'error' as const,
    message: normalized.message,
    stackTrace: normalized.stack,
    metadata: cleanMetadata(metadata),
  };
}

export async function sendFrontendLog(options: LogMindFrontendOptions, payload: FrontendLogPayload) {
  if (!options.apiKey || !options.endpoint) return;

  try {
    await (options.fetchImpl ?? fetch)(options.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
      },
      body: JSON.stringify({
        ...payload,
        api: cleanMetadata(payload.api, options.maskFields),
        frontend: cleanMetadata(payload.frontend, options.maskFields),
        metadata: cleanMetadata(payload.metadata, options.maskFields),
      }),
    });
  } catch {
    // ignored: logging must never break the host frontend app
  }
}

export function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message || error.name,
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: 'Unknown frontend error' };
}

export function browserMetadata(windowRef?: Window): Record<string, unknown> {
  if (!windowRef) return {};

  return {
    pageUrl: windowRef.location?.href,
    route: windowRef.location?.pathname,
    userAgent: windowRef.navigator?.userAgent,
    language: windowRef.navigator?.language,
    viewport: {
      width: windowRef.innerWidth,
      height: windowRef.innerHeight,
    },
  };
}

function cleanMetadata(value?: Record<string, unknown>, fields = DEFAULT_MASK_FIELDS) {
  return value === undefined ? undefined : (maskSensitiveData(value, fields) as Record<string, unknown>);
}
