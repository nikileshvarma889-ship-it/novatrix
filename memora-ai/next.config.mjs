/** @type {import('next').NextConfig} */
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const nextConfig = {
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  reactStrictMode: true,
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com" }, { protocol: "https", hostname: "yt3.ggpht.com" }] },
  serverExternalPackages: ["unpdf"],
  async rewrites() {
    // Optional: serve Supabase through this app's origin (NEXT_PUBLIC_SUPABASE_URL=/sb), e.g. for a single-URL preview.
    const internal = process.env.SUPABASE_INTERNAL_URL;
    return internal && process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("/") ? [{ source: "/sb/:path*", destination: `${internal}/:path*` }] : [];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};
export default nextConfig;
