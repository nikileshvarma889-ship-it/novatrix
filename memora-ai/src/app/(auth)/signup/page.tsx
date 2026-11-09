"use client";
import Link from "next/link";
import { useState } from "react";
import { MailCheck, UserPlus } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const strong = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong) { setError("Use at least 8 characters with letters and numbers."); return; }
    setLoading(true); setError(null);
    const { data, error } = await supabaseBrowser().auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard` },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    // When email confirmation is enabled, no session is returned until the link is clicked.
    if (data.session) window.location.href = "/dashboard";
    else setSent(true);
  };

  if (sent)
    return (
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><MailCheck className="h-7 w-7" /></div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Check your email</h2>
        <p className="mt-2 text-sm text-muted">We sent a verification link to <span className="font-medium text-fg">{email}</span>. Open it to activate your account, then log in.</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand hover:underline">Back to log in</Link>
      </div>
    );

  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
      <p className="mt-1.5 text-sm text-muted">Start building your personal study memory.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field label="Full name"><Input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sai Kiran" maxLength={80} /></Field>
        <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        <Field label="Password" hint="At least 8 characters, with letters and numbers.">
          <Input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {password && (
          <div className="flex gap-1.5" aria-hidden="true">
            {[password.length >= 8, /[A-Za-z]/.test(password) && /\d/.test(password), password.length >= 12 || /[^A-Za-z0-9]/.test(password)].map((ok, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${ok ? "bg-ok" : "bg-surface-2"}`} />
            ))}
          </div>
        )}
        {error && <div className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">{error}</div>}
        <Button type="submit" loading={loading} className="h-11 w-full"><UserPlus className="h-4 w-4" />Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Log in</Link></p>
    </>
  );
}
