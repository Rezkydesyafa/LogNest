import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'logmind_access_token';
export const REFRESH_COOKIE = 'logmind_refresh_token';

export type SessionPayload = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

export async function upstream(path: string, init?: RequestInit) {
  const baseUrl = process.env.LOGMIND_API_URL ?? 'http://localhost:3000';
  return fetch(`${baseUrl}${path}`, { ...init, cache: 'no-store' });
}

export async function relay(response: Response) {
  const body = await response.text();
  return new NextResponse(body || null, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}

/**
 * Writes the session cookies.
 *
 * The access token cookie expires with the token itself; the refresh token lives longer and
 * is scoped to `/api` so it never travels with a page request.
 */
export function setSessionCookies(response: NextResponse, session: SessionPayload) {
  const secure = process.env.NODE_ENV === 'production';

  response.cookies.set(SESSION_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: session.expiresIn ?? 900,
  });

  if (session.refreshToken) {
    response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/api',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.set(REFRESH_COOKIE, '', { path: '/api', maxAge: 0 });
  return response;
}

/**
 * Exchanges the stored refresh token for a fresh access token.
 *
 * Returns undefined when there is nothing to refresh or the refresh token is spent, which
 * the caller turns into a 401 so the browser is sent back to the login page.
 */
export async function refreshSession(): Promise<SessionPayload | undefined> {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return undefined;

  const response = await upstream('/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return undefined;

  const payload = (await response.json().catch(() => null)) as { data?: SessionPayload } | null;
  return payload?.data?.accessToken ? payload.data : undefined;
}
