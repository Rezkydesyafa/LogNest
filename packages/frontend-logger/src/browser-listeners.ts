import type { FrontendLogPayload } from './sdk';

type SendLog = (payload: Omit<FrontendLogPayload, 'serviceName' | 'environment' | 'timestamp' | 'frontend'>) => void;

export function setupBrowserListeners(windowRef: Window, send: SendLog) {
  const onError = (event: ErrorEvent) => {
    const normalized = normalizeError(event.error ?? event.message);
    send({
      level: 'error',
      message: event.message || 'window.onerror',
      stackTrace: normalized.stack,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const normalized = normalizeError(event.reason);
    send({
      level: 'error',
      message: normalized.message,
      stackTrace: normalized.stack,
      metadata: { type: 'unhandledrejection' },
    });
  };

  windowRef.addEventListener('error', onError);
  windowRef.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    windowRef.removeEventListener('error', onError);
    windowRef.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack };
  if (typeof error === 'string') return { message: error };
  return { message: 'Unknown frontend error' };
}
