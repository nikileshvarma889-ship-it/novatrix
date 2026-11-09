"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const notice = params.get("notice");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(/confirm/i.test(error.message) ? "Please verify your email first — check your inbox for the confirmation link." : /invalid/i.test(error.message) ? "Incorrect email or password." : error.message);
      return;
    }
    router.replace(safeNext(params.get("next")));
    router.refresh();
  };

  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
      <p className="mt-1.5 text-sm text-muted">Log in to continue to MEMORA AI.</p>
      {notice && <div className="mt-5 rounded-xl border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-sm text-ok">{notice}</div>}
      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        <Field label="Password">
          <div className="relative">
            <Input type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </Field>
        <div className="flex justify-end"><Link href="/forgot-password" className="text-xs text-brand hover:underline">Forgot password?</Link></div>
        {error && <div className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">{error}</div>}
        <Button type="submit" loading={loading} className="h-11 w-full"><LogIn className="h-4 w-4" />Log in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">New to MEMORA? <Link href="/signup" className="font-medium text-brand hover:underline">Create an account</Link></p>
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
