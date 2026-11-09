"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/shell/Logo";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Reached from the password-reset email (the callback route has already created a recovery session). */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { setError("Use at least 8 characters with letters and numbers."); return; }
    if (password !== confirm) { setError("The passwords don't match."); return; }
    setLoading(true); setError(null);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(/session/i.test(error.message) ? "This reset link has expired. Please request a new one." : error.message); return; }
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <div className="card w-full max-w-[400px] p-7">
        <Logo className="mb-8" />
        <h2 className="text-2xl font-semibold tracking-tight">Choose a new password</h2>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="New password"><Input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label="Confirm password"><Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          {error && <div className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">{error}</div>}
          <Button type="submit" loading={loading} className="h-11 w-full"><ShieldCheck className="h-4 w-4" />Update password</Button>
        </form>
      </div>
    </div>
  );
}
