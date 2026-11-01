"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import clsx from "clsx";

// ---------- API ----------
export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth")) window.location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`, (data as { details?: unknown }).details);
  return data as T;
}

/** GET with loading/error state and a reload function. */
export function useApi<T>(url: string | null, poll?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!url) return;
    try {
      setData(await api<T>(url));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    load();
    if (!poll) return;
    const id = setInterval(load, poll);
    return () => clearInterval(id);
  }, [load, poll]);
  return { data, error, loading, reload: load, setData };
}

// ---------- toasts ----------
type Toast = { id: number; kind: "ok" | "err"; text: string };
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:items-end">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className={clsx("glass pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-sm", t.kind === "err" ? "text-red-700" : "text-ink")}
            >
              {t.kind === "err" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/** Run an async action with a toast for success/failure. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (ok) toast("ok", ok);
        return r;
      } catch (e) {
        toast("err", (e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { busy, run };
}

// ---------- layout pieces ----------
export const Page = ({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 md:px-8 md:pt-8">
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle ? <p className="muted mt-1 max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
    {children}
  </motion.div>
);

export const Card = ({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("card", className)} {...p}>
    {children}
  </div>
);

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={clsx("h-4 w-4 animate-spin", className)} />;

export const Loading = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex items-center gap-2 py-10 text-sm text-ink-soft">
    <Spinner /> {label}
  </div>
);

export const ErrorBox = ({ error }: { error: string }) => (
  <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700">
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
  </div>
);

export const Notice = ({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) => (
  <div className={clsx("flex items-start gap-2 rounded-xl border px-4 py-3 text-sm", tone === "warn" ? "border-amber-200 bg-amber-50/80 text-amber-800" : "border-brand-100 bg-brand-50/80 text-ink-soft")}>
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
    <div>{children}</div>
  </div>
);

export const Empty = ({ icon: Icon, title, text, action }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-brand-200 bg-white/50 px-6 py-14 text-center">
    <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-100 to-lilac-100 text-brand-600">
      <Icon className="h-6 w-6" />
    </div>
    <div className="font-display text-lg font-bold">{title}</div>
    <p className="muted mt-1 max-w-md">{text}</p>
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

const STATUS: Record<string, [string, string]> = {
  draft: ["Draft", "bg-slate-100 text-slate-600"],
  scripting: ["Writing script", "bg-lilac-100 text-lilac-500"],
  rendering: ["Rendering", "bg-brand-100 text-brand-600"],
  ready: ["Waiting for approval", "bg-amber-100 text-amber-700"],
  waiting_approval: ["Waiting for approval", "bg-amber-100 text-amber-700"],
  approved: ["Approved", "bg-emerald-100 text-emerald-700"],
  scheduled: ["Scheduled", "bg-sky-100 text-sky-700"],
  publishing: ["Publishing", "bg-brand-100 text-brand-600"],
  published: ["Published", "bg-emerald-100 text-emerald-700"],
  failed: ["Failed", "bg-red-100 text-red-700"],
  rejected: ["Rejected", "bg-slate-100 text-slate-500"],
  cancelled: ["Cancelled", "bg-slate-100 text-slate-500"],
  connected: ["Connected", "bg-emerald-100 text-emerald-700"],
  expired: ["Reconnect needed", "bg-amber-100 text-amber-700"],
  error: ["Error", "bg-red-100 text-red-700"],
  active: ["Active", "bg-emerald-100 text-emerald-700"],
  paused: ["Paused", "bg-slate-100 text-slate-600"],
  open: ["Open", "bg-sky-100 text-sky-700"],
  replied: ["Replied", "bg-emerald-100 text-emerald-700"],
  resolved: ["Resolved", "bg-slate-100 text-slate-600"],
};
export const StatusBadge = ({ status }: { status: string }) => {
  const [label, cls] = STATUS[status] ?? [status, "bg-slate-100 text-slate-600"];
  return <span className={clsx("chip", cls)}>{label}</span>;
};

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="label">{label}</span>
    {children}
    {hint ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
  </label>
);

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 p-0 backdrop-blur-sm md:items-center md:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={clsx("max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-lift md:rounded-3xl", wide ? "md:max-w-3xl" : "md:max-w-lg")}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <button className="btn-ghost !p-2" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
export const mediaUrl = (id: string | null | undefined, download = false) => (id ? `/api/media/${id}/file${download ? "?download=1" : ""}` : "");
