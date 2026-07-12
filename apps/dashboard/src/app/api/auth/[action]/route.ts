import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { relay, SESSION_COOKIE, upstream } from "@/lib/server-api"

type Context = { params: Promise<{ action: string }> }

export async function POST(request: NextRequest, context: Context) {
  const { action } = await context.params
  if (action === "logout") {
    const response = NextResponse.json({ data: { loggedOut: true } })
    response.cookies.delete(SESSION_COOKIE)
    return response
  }
  if (action !== "login" && action !== "register") return NextResponse.json({ error: "Not found" }, { status: 404 })

  const response = await upstream(`/auth/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: await request.text() })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.data?.accessToken) return NextResponse.json(payload ?? { error: "Authentication failed" }, { status: response.status })

  const result = NextResponse.json(payload)
  result.cookies.set(SESSION_COOKIE, payload.data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 86400,
  })
  return result
}

export async function GET(_request: NextRequest, context: Context) {
  const { action } = await context.params
  if (action !== "me") return NextResponse.json({ error: "Not found" }, { status: 404 })
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return relay(await upstream("/auth/me", { headers: { authorization: `Bearer ${token}` } }))
}
