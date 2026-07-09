import type { FrontendLogPayload } from './sdk';

type SendLog = (payload: Omit<FrontendLogPayload, 'serviceName' | 'environment' | 'timestamp' | 'frontend'>) => void;

export function setupFetchInstrumentation(windowRef: Window, send: SendLog) {
  const originalFetch = windowRef.fetch?.bind(windowRef);
  if (!originalFetch) return () => undefined;

  windowRef.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const startedAt = Date.now();
    const request = requestInfo(input, init);

    try {
      const response = await originalFetch(input, init);
      const durationMs = Date.now() - startedAt;

      if (!response.ok) {
        send({
          level: response.status >= 500 ? 'error' : 'warn',
          message: `${request.method} ${request.url} failed with ${response.status}`,
          requestId: response.headers.get('x-request-id') ?? undefined,
          api: {
            method: request.method,
            path: request.url,
            statusCode: response.status,
            durationMs,
            requestId: response.headers.get('x-request-id') ?? undefined,
            errorMessage: response.statusText,
          },
        });
      }

      return response;
    } catch (error) {
      send({
        level: 'error',
        message: `${request.method} ${request.url} failed: ${errorMessage(error)}`,
        api: {
          method: request.method,
          path: request.url,
          durationMs: Date.now() - startedAt,
          errorMessage: errorMessage(error),
        },
      });
      throw error;
    }
  };

  return () => {
    windowRef.fetch = originalFetch;
  };
}

function requestInfo(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) {
    return {
      method: init?.method ?? input.method,
      url: input.url,
    };
  }

  return {
    method: init?.method ?? 'GET',
    url: String(input),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
