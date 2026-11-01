import { NextRequest, NextResponse } from "next/server";

// Cheap gate: pages need a session cookie (full validation happens server-side).
const PUBLIC = ["/login", "/signup", "/api/auth", "/api/health", "/privacy", "/terms", "/_next", "/favicon"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.next(); // API routes check sessions themselves
  if (!req.cookies.get("rw_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
