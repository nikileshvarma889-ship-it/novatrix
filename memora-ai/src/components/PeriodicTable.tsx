"use client";
import { useState } from "react";
import { CAT_NAMES, ELEMENTS, type Cat, type Element } from "@/lib/periodic";
import { cn } from "@/lib/utils";

const CAT_COLOR: Record<Cat, string> = {
  am: "bg-rose-500/20 border-rose-400/40", ae: "bg-orange-500/20 border-orange-400/40", tm: "bg-amber-500/15 border-amber-400/40",
  pt: "bg-teal-500/15 border-teal-400/40", md: "bg-lime-500/15 border-lime-400/40", nm: "bg-sky-500/15 border-sky-400/40",
  hg: "bg-cyan-500/20 border-cyan-400/40", ng: "bg-violet-500/20 border-violet-400/40", ln: "bg-pink-500/15 border-pink-400/40", ac: "bg-fuchsia-500/15 border-fuchsia-400/40",
};

/** Interactive periodic table: main 18-column grid plus lanthanide / actinide rows. Tap an element for details. */
export function PeriodicTable() {
  const [sel, setSel] = useState<Element | null>(ELEMENTS[5]);
  const [hl, setHl] = useState<Cat | null>(null);
  const pos = (e: Element) => {
    if (e.cat === "ln" && e.z >= 57 && e.z <= 71) return { row: 9, col: e.z - 57 + 3 };
    if (e.cat === "ac" && e.z >= 89 && e.z <= 103) return { row: 10, col: e.z - 89 + 3 };
    return { row: e.period, col: e.group! };
  };
  return (
    <div className="space-y-4">
      {sel && (
        <div className="card flex items-center gap-5 p-4">
          <div className={cn("grid h-20 w-20 shrink-0 place-items-center rounded-2xl border text-center", CAT_COLOR[sel.cat])}>
            <div><div className="text-[11px] text-muted">{sel.z}</div><div className="text-3xl font-bold">{sel.sym}</div></div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <div><div className="label mb-0">Name</div>{sel.name}</div>
            <div><div className="label mb-0">Atomic mass</div>{sel.mass} u</div>
            <div><div className="label mb-0">Group / Period</div>{sel.group ?? "—"} / {sel.period}</div>
            <div><div className="label mb-0">Category</div>{CAT_NAMES[sel.cat]}</div>
          </div>
        </div>
      )}
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[860px] gap-1" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))", gridTemplateRows: "repeat(10, auto)" }}>
          {ELEMENTS.map((e) => {
            const p = pos(e);
            return (
              <button key={e.z} onClick={() => setSel(e)} style={{ gridRow: p.row, gridColumn: p.col }}
                className={cn("aspect-square rounded-md border p-0.5 text-center transition hover:scale-110 hover:z-10", CAT_COLOR[e.cat], sel?.z === e.z && "ring-2 ring-brand", hl && hl !== e.cat && "opacity-25")}
                title={`${e.name} (${e.z})`} aria-label={`${e.name}, atomic number ${e.z}`}>
                <div className="text-[8px] leading-none text-muted">{e.z}</div>
                <div className="text-[13px] font-bold leading-tight">{e.sym}</div>
              </button>
            );
          })}
          <div style={{ gridRow: 8, gridColumn: "1 / span 18" }} className="h-3" />
          <div style={{ gridRow: 9, gridColumn: "1 / span 2" }} className="self-center text-right text-[10px] text-muted">Lanthanides 57–71</div>
          <div style={{ gridRow: 10, gridColumn: "1 / span 2" }} className="self-center text-right text-[10px] text-muted">Actinides 89–103</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CAT_NAMES) as Cat[]).map((c) => (
          <button key={c} onMouseEnter={() => setHl(c)} onMouseLeave={() => setHl(null)} onClick={() => setHl(hl === c ? null : c)} className={cn("rounded-full border px-2.5 py-1 text-[11px]", CAT_COLOR[c])}>{CAT_NAMES[c]}</button>
        ))}
      </div>
      <p className="text-xs text-subtle">Atomic masses are IUPAC standard values (rounded); values in [ ] are mass numbers of the most stable isotope.</p>
    </div>
  );
}
