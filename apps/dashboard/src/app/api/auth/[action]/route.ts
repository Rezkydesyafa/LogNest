import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  clearSessionCookies,
  refreshSession,
  relay,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  SessionPayload,
  setSessionCookies,
  upstream,
} from '@/lib/server-api';

type Context = { params: Promise<{ action: string }> };

export async function POST(request: NextRequest, context: Context) {
  const { action } = await context.params;

  if (action === 'logout') return logout();

  // Password reset needs no session and issues none, so it is relayed straight through.
  if (action === 'forgot-password' || action === 'reset-password') {
    return relay(
      await upstream(`/auth/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: await request.text(),
      }),
    );
  }

  if (action !== 'login' && action !== 'register')
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const response = await upstream(`/auth/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await request.text(),
  });
  const payload = (await response.json().catch(() => null)) as { data?: SessionPayload } | null;

  if (!response.ok || !payload?.data?.accessToken)
    return NextResponse.json(payload ?? { error: 'Authentication failed' }, {
      status: response.status,
    });

  return setSessionCookies(NextResponse.json(payload), payload.data);
}

export async function GET(_request: NextRequest, context: Context) {
  const { action } = await context.params;
  if (action !== 'me') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const response = token ? await me(token) : undefined;

  if (response && response.status !== 401) return relay(response);

  // Same refresh-then-retry path as the API proxy, so a reload after the access token
  // expired restores the session instead of logging the user out.
  const session = await refreshSession();
  if (!session) {
    return clearSessionCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  return setSessionCookies(await relay(await me(session.accessToken)), session);
}

function me(accessToken: string) {
  return upstream('/auth/me', { headers: { authorization: `Bearer ${accessToken}` } });
}

/** Revokes the session server-side before dropping the cookies. */
async function logout() {
  const store = await cookies();
  const accessToken = store.get(SESSION_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  if (accessToken || refreshToken) {
    await upstream('/auth/logout', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ refreshToken }),
      // Logging out locally must succeed even if the API is unreachable.
    }).catch(() => undefined);
  }

  return clearSessionCookies(NextResponse.json({ data: { loggedOut: true } }));
}
