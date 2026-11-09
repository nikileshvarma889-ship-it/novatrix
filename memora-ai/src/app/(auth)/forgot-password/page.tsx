"use client";
import Link from "next/link";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${site}/auth/callback?next=/auth/reset-password` });
    setLoading(false);
    if (error) setError(error.message);
    else setDone(true);
  };

  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">Reset your password</h2>
      <p className="mt-1.5 text-sm text-muted">We&apos;ll email you a secure link to choose a new password.</p>
      {done ? (
        <div className="mt-7 rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">If an account exists for {email}, a reset link is on its way. The link expires after a short time.</div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {error && <div className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">{error}</div>}
          <Button type="submit" loading={loading} className="h-11 w-full"><KeyRound className="h-4 w-4" />Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted"><Link href="/login" className="font-medium text-brand hover:underline">Back to log in</Link></p>
    </>
  );
}
