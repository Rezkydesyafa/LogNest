import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { refreshSession, SESSION_COOKIE, upstream } from '@/lib/server-api';

// Streaming needs the Node runtime and must never be cached or statically analysed.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dedicated SSE passthrough.
 *
 * The generic proxy buffers the whole upstream body before replying, which would never
 * deliver a stream. Here the upstream body is piped straight through instead.
 */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const open = (accessToken: string) =>
    upstream(`/events/stream?projectId=${encodeURIComponent(projectId)}`, {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'text/event-stream' },
      signal: request.signal,
    });

  let response = token ? await open(token) : undefined;

  // EventSource reconnects on its own, and it will do so with an expired access token.
  if (!response || response.status === 401) {
    const session = await refreshSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    response = await open(session.accessToken);
  }

  if (!response.ok || !response.body) {
    return NextResponse.json({ error: 'Stream unavailable' }, { status: response.status || 502 });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Tells nginx-style proxies not to buffer the response.
      'x-accel-buffering': 'no',
    },
  });
}
