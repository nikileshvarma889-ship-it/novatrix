import { Logo } from "@/components/shell/Logo";

export const metadata = { title: "Setup required" };
export const dynamic = "force-dynamic";

/** Shown only when the server has no Supabase configuration yet. */
export default function SetupPage() {
  const has = (k: string) => Boolean(process.env[k]);
  const rows = [
    ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL", true],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon (public) key", true],
    ["OPENAI_API_KEY", "AI features (chat, tutor, quizzes, flashcards)", false],
    ["YOUTUBE_API_KEY", "YouTube Learning search", false],
  ] as const;
  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <div className="card w-full max-w-xl p-8">
        <Logo />
        <h1 className="mt-8 text-2xl font-semibold">Finish setting up MEMORA AI</h1>
        <p className="mt-2 text-sm text-muted">Add these to <code className="rounded bg-surface-2 px-1.5">.env.local</code> (or your host&apos;s environment variables), run the SQL migrations in <code className="rounded bg-surface-2 px-1.5">supabase/migrations</code>, then restart the server. See README.md for step-by-step instructions.</p>
        <ul className="mt-6 space-y-2">
          {rows.map(([k, d, req]) => (
            <li key={k} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm">
              <div><code className="font-mono text-[13px]">{k}</code><div className="text-xs text-muted">{d}{req ? " — required" : " — optional"}</div></div>
              <span className={has(k) ? "text-ok" : req ? "text-danger" : "text-warn"}>{has(k) ? "set" : "missing"}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
