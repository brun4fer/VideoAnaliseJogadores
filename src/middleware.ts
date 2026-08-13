import { NextRequest, NextResponse } from "next/server";
const SESSION_COOKIE = "player_analysis_session";
const publicPaths = ["/login", "/register", "/api/auth/login", "/api/auth/register"];
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (publicPaths.includes(path) || path.startsWith("/_next") || path.includes(".")) return NextResponse.next();
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const url = new URL("/login", request.url); url.searchParams.set("next", path); return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
