import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PUBLIC = ["/login", "/signup", "/forgot-password", "/auth", "/offline", "/setup"];

/** Server-side Supabase URL: the internal address when the public one is a same-origin proxy path. */
export function serverSupabaseUrl() {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return u.startsWith("/") ? process.env.SUPABASE_INTERNAL_URL || "http://127.0.0.1:54321" : u;
}

export function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Refreshes the auth session cookie on every request and guards private routes. */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!isConfigured()) {
    if (path.startsWith("/setup") || path.startsWith("/api")) return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(serverSupabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { name: "sb-memora-auth-token" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const isPublic = path === "/" || PUBLIC.some((p) => path.startsWith(p));
  if (!user && !isPublic && !path.startsWith("/api")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  if (user && (path === "/" || path === "/login" || path === "/signup")) return NextResponse.redirect(new URL("/dashboard", request.url));
  if (!user && path === "/") return NextResponse.redirect(new URL("/login", request.url));
  return response;
}
