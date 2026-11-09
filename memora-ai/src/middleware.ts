import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!sb/|_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|offline.html|robots.txt|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};
