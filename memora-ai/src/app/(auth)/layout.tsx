import { Brain, CalendarDays, GraduationCap, Sparkles } from "lucide-react";
import { Logo } from "@/components/shell/Logo";

const FEATURES = [
  { icon: Brain, title: "A memory you can ask", text: "Save anything in plain words. Ask later — MEMORA finds it and shows where it came from." },
  { icon: GraduationCap, title: "Intermediate & EAPCET tutor", text: "Maths, Physics and Chemistry in English, Telugu or both, with notebook-style solutions." },
  { icon: CalendarDays, title: "Plans that fit your day", text: "Timetables, assignments, revision reminders and spaced-repetition flashcards." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-border/60 p-12 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-brand/25 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[460px] w-[460px] rounded-full bg-brand-2/20 blur-[120px]" />
        <Logo className="relative" />
        <div className="relative my-auto max-w-lg">
          <div className="chip mb-5 border-brand/30 text-brand"><Sparkles className="h-3.5 w-3.5" />Personal AI memory + study companion</div>
          <h1 className="text-[44px] font-semibold leading-[1.08] tracking-tight">
            Your Memory.<br />Your Studies.<br /><span className="text-gradient">Your AI.</span>
          </h1>
          <div className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface/70 text-brand"><f.icon className="h-5 w-5" /></div>
                <div><div className="text-sm font-semibold">{f.title}</div><div className="mt-0.5 text-sm text-muted">{f.text}</div></div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-subtle">Your data is private to your account and protected with row-level security.</p>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[400px]">
          <Logo className="mb-10 lg:hidden" />
          {children}
        </div>
      </section>
    </div>
  );
}
