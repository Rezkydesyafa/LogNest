import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { isAllowedProxyRequest } from "@/lib/proxy-policy"
import { relay, SESSION_COOKIE, upstream } from "@/lib/server-api"

type Context = { params: Promise<{ path: string[] }> }

async function handler(request: NextRequest, context: Context) {
  const segments = (await context.params).path
  const path = `/${segments.map(encodeURIComponent).join("/")}`
  if (!isAllowedProxyRequest(request.method, path)) return NextResponse.json({ error: "Route not allowed" }, { status: 404 })
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const response = await upstream(`${path}${request.nextUrl.search}`, {
    method: request.method,
    headers: { authorization: `Bearer ${token}`, "content-type": request.headers.get("content-type") ?? "application/json" },
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
  })
  const result = await relay(response)
  if (response.status === 401) result.cookies.delete(SESSION_COOKIE)
  return result
}

export const GET = handler
export const POST = handler
export const PATCH = handler
export const DELETE = handler
