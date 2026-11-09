import Link from "next/link";
import { LogoMark } from "@/components/shell/Logo";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <LogoMark size={56} className="mx-auto" />
        <h1 className="mt-6 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">MEMORA couldn&apos;t find what you were looking for.</p>
        <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-brand-grad px-5 py-2.5 text-sm font-medium text-white">Go to dashboard</Link>
      </div>
    </div>
  );
}
