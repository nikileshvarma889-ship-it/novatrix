"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { api, ErrorBox, Field, Spinner } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/dashboard";
  const [f, setF] = useState({ name: "", email: "", password: "", workspace: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: mode === "login" ? { email: f.email, password: f.password } : f });
      router.push(next.startsWith("/") ? next : "/dashboard");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass w-full max-w-md rounded-3xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-lilac-500 text-white shadow-lift">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-xl font-extrabold">Reelwise</div>
            <div className="text-xs text-ink-faint">AI video studio for social media</div>
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your workspace"}</h1>
        <p className="muted mb-6 mt-1">{mode === "login" ? "Sign in to continue." : "You'll connect your social accounts after signing up."}</p>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" ? (
            <>
              <Field label="Your name"><input className="input" required value={f.name} onChange={set("name")} autoComplete="name" /></Field>
              <Field label="Workspace / business name"><input className="input" required value={f.workspace} onChange={set("workspace")} /></Field>
            </>
          ) : null}
          <Field label="Email"><input className="input" type="email" required value={f.email} onChange={set("email")} autoComplete="email" /></Field>
          <Field label="Password" hint={mode === "signup" ? "At least 10 characters." : undefined}>
            <input className="input" type="password" required minLength={mode === "signup" ? 10 : 1} value={f.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </Field>
          {err ? <ErrorBox error={err} /> : null}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner /> : null} {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="muted mt-6 text-center">
          {mode === "login" ? (
            <>New here? <Link className="font-semibold text-brand-600" href="/signup">Create an account</Link></>
          ) : (
            <>Already have an account? <Link className="font-semibold text-brand-600" href="/login">Sign in</Link></>
          )}
        </p>
      </motion.div>
    </div>
  );
}
