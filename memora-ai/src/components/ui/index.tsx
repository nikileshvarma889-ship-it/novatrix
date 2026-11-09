"use client";
import React, { forwardRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "icon";
  loading?: boolean;
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-10 px-4",
        size === "icon" && "h-9 w-9",
        variant === "primary" && "bg-brand-grad text-brand-fg shadow-[0_6px_20px_-8px_rgb(var(--brand)/0.8)] hover:brightness-110",
        variant === "secondary" && "border border-border bg-surface-2 text-fg hover:bg-surface-2/70",
        variant === "outline" && "border border-border text-fg hover:bg-surface-2/60",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
        variant === "danger" && "bg-danger/90 text-white hover:bg-danger",
        className,
      )}
      {...p}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
});

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card card-pad", className)} {...p}>{children}</div>;
}
export function CardTitle({ icon, title, action, sub }: { icon?: React.ReactNode; title: React.ReactNode; action?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {icon ? <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">{icon}</div> : null}
        <div>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {sub ? <p className="text-xs text-muted">{sub}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn("input", className)} {...p} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn("input min-h-[96px] resize-y leading-relaxed", className)} {...p} />;
});
export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("input appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238c92ac' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>{children}</select>;
}
export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-subtle">{hint}</span> : null}
    </label>
  );
}

export function Badge({ children, tone = "default", className }: { children: React.ReactNode; tone?: "default" | "brand" | "ok" | "warn" | "danger" | "math" | "phys" | "chem"; className?: string }) {
  const t = {
    default: "bg-surface-2 text-muted border-border",
    brand: "bg-brand/12 text-brand border-brand/25",
    ok: "bg-ok/12 text-ok border-ok/25",
    warn: "bg-warn/12 text-warn border-warn/25",
    danger: "bg-danger/12 text-danger border-danger/25",
    math: "bg-math/12 text-math border-math/25",
    phys: "bg-phys/12 text-phys border-phys/25",
    chem: "bg-chem/12 text-chem border-chem/25",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", t, className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand", className)} />;
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-lg bg-surface-2", className)}><div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" /></div>;
}

export function Empty({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      {icon ? <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">{icon}</div> : null}
      <div className="text-sm font-medium">{title}</div>
      {text ? <p className="mt-1 max-w-sm text-xs text-muted">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div role="dialog" aria-modal="true" aria-label={title} className={cn("card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 320 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn("scrollbar-thin flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-2/50 p-1", className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn("relative whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition", value === t.id ? "text-fg" : "text-muted hover:text-fg")}>
          {value === t.id && <motion.span layoutId={`tab-${tabs.map((x) => x.id).join("")}`} className="absolute inset-0 rounded-lg bg-surface shadow-sm" transition={{ type: "spring", damping: 30, stiffness: 400 }} />}
          <span className="relative">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "math" | "phys" | "chem" | "ok" }) {
  const v = Math.max(0, Math.min(100, value));
  const bg = { brand: "bg-brand-grad", math: "bg-math", phys: "bg-phys", chem: "bg-chem", ok: "bg-ok" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cn("h-full rounded-full", bg)} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, label, color = "rgb(var(--brand))" }: { value: number; size?: number; stroke?: number; label?: React.ReactNode; color?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(var(--surface-2))" strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v / 100) }} transition={{ duration: 0.9, ease: "easeOut" }} />
      </svg>
      <div className="absolute text-xs font-semibold">{label ?? `${Math.round(v)}%`}</div>
    </div>
  );
}

export function PageHeader({ title, sub, icon, actions }: { title: string; sub?: string; icon?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        {icon ? <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-grad text-white shadow-glow">{icon}</div> : null}
        <div>
          <h1 className="h-page">{title}</h1>
          {sub ? <p className="mt-0.5 text-sm text-muted">{sub}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AiLabel({ text = "AI-generated" }: { text?: string }) {
  return <Badge tone="brand">✦ {text}</Badge>;
}
