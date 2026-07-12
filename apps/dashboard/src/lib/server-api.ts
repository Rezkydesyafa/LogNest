import { NextResponse } from "next/server";

export const SESSION_COOKIE = "logmind_access_token";

export async function upstream(path: string, init?: RequestInit) {
  const baseUrl = process.env.LOGMIND_API_URL ?? "http://localhost:3000";
  return fetch(`${baseUrl}${path}`, { ...init, cache: "no-store" });
}

export async function relay(response: Response) {
  const body = await response.text();
  return new NextResponse(body || null, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ?? "application/json",
    },
  });
}
