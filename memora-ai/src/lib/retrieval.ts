import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const STOP = new Set(("a an the and or but if then else of to in on at by for with from about into over after before is are was were be been being am do does did done " +
  "have has had having i me my mine we our you your he she it its they them their this that these those what which who whom whose when where why how " +
  "can could should would will shall may might must please tell show give find search remember remind saved save note notes memory memories any some " +
  "know told say said get got want need let also just like really very much more most up down out again here there all").split(" "));

/** Turns a natural question into search keywords (keeps Telugu and other non-Latin words). */
export function keywords(text: string) {
  return Array.from(new Set(text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)))).slice(0, 12);
}

export type Source = { kind: "memory" | "note" | "task"; id: string; ref: string; title: string; date?: string; detail?: string };

/** Finds the user's own memories / notes / tasks relevant to a question. RLS restricts every query to the signed-in user. */
export async function retrieveContext(sb: SupabaseClient, question: string, opts: { memories?: number; notes?: number } = {}) {
  const kw = keywords(question);
  const q = kw.join(" ");
  const sources: Source[] = [];
  const blocks: string[] = [];
  if (q) {
    const [mem, notes] = await Promise.all([
      sb.rpc("search_memories", { q, lim: opts.memories ?? 6, include_archived: false }),
      sb.rpc("search_notes", { q, lim: opts.notes ?? 3 }),
    ]);
    (mem.data ?? []).forEach((m: { id: string; title: string; content: string; category: string; tags: string[]; created_at: string; updated_at: string }, i: number) => {
      const ref = `M${i + 1}`;
      sources.push({ kind: "memory", id: m.id, ref, title: m.title, date: m.updated_at });
      blocks.push(`[${ref}] MEMORY (category: ${m.category}; saved ${m.created_at.slice(0, 10)}; tags: ${(m.tags ?? []).join(", ") || "none"})\nTitle: ${m.title}\n${m.content}`);
    });
    (notes.data ?? []).forEach((n: { id: string; title: string; snippet: string; subject: string | null; updated_at: string }, i: number) => {
      const ref = `N${i + 1}`;
      sources.push({ kind: "note", id: n.id, ref, title: n.title, date: n.updated_at });
      blocks.push(`[${ref}] NOTE (${n.subject ?? "general"}; updated ${n.updated_at.slice(0, 10)})\nTitle: ${n.title}\n${n.snippet}`);
    });
    if (mem.data?.length) {
      const ids = (mem.data as { id: string }[]).map((m) => m.id);
      await sb.from("memories").update({ last_accessed_at: new Date().toISOString() }).in("id", ids);
    }
  }
  // Upcoming and overdue tasks are always useful context for planning questions.
  const soon = new Date(Date.now() + 14 * 86400000).toISOString();
  const { data: tasks } = await sb.from("tasks").select("id,title,kind,subject,due_at,start_at,status,priority").neq("status", "completed").or(`due_at.lte.${soon},start_at.lte.${soon}`).order("due_at", { ascending: true, nullsFirst: false }).limit(10);
  (tasks ?? []).forEach((t, i) => {
    const ref = `T${i + 1}`;
    const when = t.due_at ?? t.start_at;
    sources.push({ kind: "task", id: t.id, ref, title: t.title, date: when ?? undefined });
    blocks.push(`[${ref}] ${t.kind.toUpperCase()} — ${t.title}${t.subject ? ` (${t.subject})` : ""}; ${t.due_at ? "due " + t.due_at : t.start_at ? "scheduled " + t.start_at : "no date"}; status ${t.status}; priority ${t.priority}`);
  });
  return { sources, context: blocks.join("\n\n"), keywords: kw };
}
