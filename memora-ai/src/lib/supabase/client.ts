"use client";
import { createBrowserClient } from "@supabase/ssr";

/** One fixed auth-cookie name, so browser and server agree even when they reach Supabase via different hosts. */
export const AUTH_COOKIE = "sb-memora-auth-token";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client (anon key + the user's session cookie). Every query is filtered by Row Level Security. */
export function supabaseBrowser() {
  if (!client) {
    // A relative URL (e.g. "/sb") means Supabase is proxied through this app's own origin (see next.config.mjs).
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    client = createBrowserClient(url.startsWith("/") ? window.location.origin + url : url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookieOptions: { name: AUTH_COOKIE } });
  }
  return client;
}
