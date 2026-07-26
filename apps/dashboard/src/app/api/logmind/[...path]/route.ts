import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { isAllowedProxyRequest } from '@/lib/proxy-policy';
import {
  clearSessionCookies,
  refreshSession,
  relay,
  SESSION_COOKIE,
  setSessionCookies,
  upstream,
} from '@/lib/server-api';

type Context = { params: Promise<{ path: string[] }> };

async function handler(request: NextRequest, context: Context) {
  const segments = (await context.params).path;
  const path = `/${segments.map(encodeURIComponent).join('/')}`;
  if (!isAllowedProxyRequest(request.method, path))
    return NextResponse.json({ error: 'Route not allowed' }, { status: 404 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // The body can only be read once, so buffer it before a possible retry.
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();
  const call = (accessToken: string) =>
    upstream(`${path}${request.nextUrl.search}`, {
      method: request.method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': request.headers.get('content-type') ?? 'application/json',
      },
      body,
    });

  let response = token ? await call(token) : undefined;

  // Access tokens are short lived now, so a 401 is usually just an expired token.
  // Refresh once and replay the request rather than bouncing the user to the login page.
  if (!response || response.status === 401) {
    const session = await refreshSession();

    if (!session) {
      return clearSessionCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    response = await call(session.accessToken);
    const result = await relay(response);
    return setSessionCookies(result, session);
  }

  const result = await relay(response);
  if (response.status === 401) clearSessionCookies(result);
  return result;
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
