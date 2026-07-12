import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server-api";

export function proxy(request: NextRequest) {
  const authenticated = request.cookies.has(SESSION_COOKIE);
  const authPage =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/register";
  if (!authenticated && !authPage)
    return NextResponse.redirect(new URL("/login", request.url));
  if (authenticated && authPage)
    return NextResponse.redirect(new URL("/overview", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
