/* eslint-disable @next/next/no-img-element */
import { initials } from "@/lib/utils";

export function Avatar({ name, email, url, size = 36 }: { name?: string | null; email?: string | null; url?: string | null; size?: number }) {
  if (url) return <img src={url} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <div className="grid place-items-center rounded-full bg-brand-grad font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(name, email)}
    </div>
  );
}
