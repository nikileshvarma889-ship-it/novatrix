import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Email links (verification, password reset) land here with a one-time PKCE code that becomes a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const errDesc = url.searchParams.get("error_description");
  if (errDesc) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errDesc)}`, url.origin));
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("This link is invalid or has expired. Please try again.")}`, url.origin));
}
