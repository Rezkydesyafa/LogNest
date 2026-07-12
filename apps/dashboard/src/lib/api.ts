type Envelope<T> = { data: T; requestId?: string };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/logmind${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const payload = (await response.json().catch(() => ({}))) as Envelope<T> & {
    error?: string | { message?: string | string[] };
  };

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined")
      window.location.assign("/login");
    const detail =
      typeof payload.error === "string"
        ? payload.error
        : payload.error?.message;
    throw new ApiError(
      Array.isArray(detail) ? detail.join(", ") : (detail ?? "Request failed"),
      response.status,
    );
  }

  return payload.data;
}

export function queryString(
  values: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function formatDate(value?: string) {
  return value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Never";
}
