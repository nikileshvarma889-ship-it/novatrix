"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArchiveRestore, Brain, Clock, Filter, Mic, Pencil, Pin, PinOff, Plus, Search, Sparkles, Tag, Trash2 } from "lucide-react";
import { Badge, Button, Empty, Modal, PageHeader, Select, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { MemoryEditor, type Memory } from "@/components/editors";
import { VoiceCapture } from "@/components/VoiceCapture";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useData, must } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { MEMORY_CATEGORIES, cn } from "@/lib/utils";
import { fmt, fmtDateTime, relative } from "@/lib/dates";

const PRI_TONE = { high: "danger", medium: "warn", low: "default" } as const;
type Sort = "updated" | "created" | "priority" | "title" | "accessed";

function MemoriesInner() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const { profile } = useProfile();
  const tz = profile.timezone;
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cat, setCat] = useState("all");
  const [pri, setPri] = useState("all");
  const [view, setView] = useState<"active" | "pinned" | "archived">("active");
  const [sort, setSort] = useState<Sort>("updated");
  const [editing, setEditing] = useState<Memory | null>(null);
  const [creating, setCreating] = useState(false);
  const [voice, setVoice] = useState(false);
  const [detail, setDetail] = useState<Memory | null>(null);

  useEffect(() => { const id = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(id); }, [q]);

  const { data, loading, reload, setData } = useData(async () => {
    const sb = supabaseBrowser();
    if (debounced) {
      const ids = (must(await sb.rpc("search_memories", { q: debounced, lim: 50, include_archived: view === "archived" })) as { id: string }[]).map((r) => r.id);
      if (!ids.length) return [] as Memory[];
      const rows = must(await sb.from("memories").select("*").in("id", ids)) as Memory[];
      return ids.map((id) => rows.find((r) => r.id === id)!).filter(Boolean);
    }
    let query = sb.from("memories").select("*").eq("archived", view === "archived").limit(500);
    if (view === "pinned") query = query.eq("pinned", true);
    return must(await query.order("updated_at", { ascending: false })) as Memory[];
  }, [debounced, view]);

  const list = useMemo(() => {
    let l = (data ?? []).filter((m) => (cat === "all" || m.category === cat) && (pri === "all" || m.priority === pri));
    if (view === "active" && !debounced) l = [...l].sort((a, b) => Number(b.pinned) - Number(a.pinned));
    if (!debounced) {
      const rank = { high: 0, medium: 1, low: 2 };
      const cmp: Record<Sort, (a: Memory, b: Memory) => number> = {
        updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
        created: (a, b) => b.created_at.localeCompare(a.created_at),
        priority: (a, b) => rank[a.priority] - rank[b.priority],
        title: (a, b) => a.title.localeCompare(b.title),
        accessed: (a, b) => (b.last_accessed_at ?? "").localeCompare(a.last_accessed_at ?? ""),
      };
      l = [...l].sort((a, b) => (view === "active" ? Number(b.pinned) - Number(a.pinned) : 0) || cmp[sort](a, b));
    }
    return l;
  }, [data, cat, pri, sort, view, debounced]);

  // open ?open=<id> (from dashboard / search / chat sources)
  useEffect(() => {
    const id = params.get("open");
    if (!id) return;
    supabaseBrowser().from("memories").select("*").eq("id", id).maybeSingle().then(({ data }) => { if (data) openDetail(data as Memory); });
  }, [params]);

  const openDetail = async (m: Memory) => {
    setDetail(m);
    const now = new Date().toISOString();
    await supabaseBrowser().from("memories").update({ last_accessed_at: now }).eq("id", m.id);
  };
  const patch = async (m: Memory, p: Partial<Memory>, msg: string) => {
    const { error } = await supabaseBrowser().from("memories").update(p).eq("id", m.id);
    if (error) { toast(error.message, "error"); return; }
    toast(msg);
    setData((d) => (d ? d.map((x) => (x.id === m.id ? { ...x, ...p } : x)).filter((x) => (view === "archived" ? x.archived : !x.archived)) : d));
    if (detail?.id === m.id) setDetail({ ...m, ...p });
  };
  const remove = async (m: Memory) => {
    if (!confirm(`Delete “${m.title}” permanently?`)) return;
    const { error } = await supabaseBrowser().from("memories").delete().eq("id", m.id);
    if (error) { toast(error.message, "error"); return; }
    toast("Memory deleted.");
    setDetail(null);
    setData((d) => d?.filter((x) => x.id !== m.id) ?? d);
  };

  return (
    <div>
      <PageHeader title="My Memories" sub="Everything you've asked MEMORA to remember — private to you." icon={<Brain className="h-5 w-5" />}
        actions={<><Button variant="secondary" onClick={() => setVoice(true)}><Mic className="h-4 w-4" />Voice</Button><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New memory</Button></>} />

      <div className="card mb-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your memories (English or Telugu)…" className="input pl-10" aria-label="Search memories" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={view} onChange={(e) => setView(e.target.value as typeof view)} className="w-32" aria-label="View"><option value="active">Active</option><option value="pinned">Pinned</option><option value="archived">Archived</option></Select>
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-44" aria-label="Category"><option value="all">All categories</option>{MEMORY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          <Select value={pri} onChange={(e) => setPri(e.target.value)} className="w-32" aria-label="Priority"><option value="all">Any priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-40" aria-label="Sort" disabled={!!debounced}><option value="updated">Last updated</option><option value="created">Newest first</option><option value="accessed">Recently accessed</option><option value="priority">Priority</option><option value="title">Title A–Z</option></Select>
        </div>
      </div>
      {debounced && <p className="mb-3 flex items-center gap-1.5 text-xs text-muted"><Filter className="h-3.5 w-3.5" />Showing best matches for “{debounced}”.</p>}

      {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-36" />)}</div> : !list.length ? (
        <Empty icon={<Brain className="h-5 w-5" />} title={debounced ? "No memory matches your search" : view === "archived" ? "No archived memories" : "No memories here yet"}
          text={debounced ? "Try different words, or ask the AI assistant." : "Try: “Remember that my Physics assignment is due on Friday.”"}
          action={debounced ? <Button variant="secondary" onClick={() => router.push(`/assistant?q=${encodeURIComponent(debounced)}`)}><Sparkles className="h-4 w-4" />Ask MEMORA</Button> : <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New memory</Button>} />
      ) : (
        <motion.div layout className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {list.map((m) => (
              <motion.article layout key={m.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                className={cn("card group flex cursor-pointer flex-col p-4 transition hover:border-brand/40", m.pinned && "border-brand/30")} onClick={() => openDetail(m)}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="te line-clamp-2 text-[15px] font-semibold">{m.title}</h3>
                  {m.pinned && <Pin className="h-4 w-4 shrink-0 fill-brand text-brand" />}
                </div>
                <p className="te mt-1.5 line-clamp-3 flex-1 text-sm text-muted">{m.content || "—"}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand">{m.category}</Badge>
                  <Badge tone={PRI_TONE[m.priority]}>{m.priority}</Badge>
                  {m.source === "voice" && <Badge><Mic className="h-3 w-3" />voice</Badge>}
                  {m.tags.slice(0, 3).map((t) => <span key={t} className="chip"><Tag className="h-3 w-3" />{t}</span>)}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-subtle">
                  <span title={`Created ${fmtDateTime(m.created_at, tz)}`}>Updated {relative(m.updated_at)}</span>
                  <div className="flex gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                    <IconBtn label={m.pinned ? "Unpin" : "Pin"} onClick={() => patch(m, { pinned: !m.pinned }, m.pinned ? "Unpinned." : "Pinned.")}>{m.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</IconBtn>
                    <IconBtn label="Edit" onClick={() => setEditing(m)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label={m.archived ? "Restore" : "Archive"} onClick={() => patch(m, { archived: !m.archived, pinned: false }, m.archived ? "Restored." : "Archived.")}>{m.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}</IconBtn>
                    <IconBtn label="Delete" onClick={() => remove(m)} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <Modal open={!!detail} onClose={() => { setDetail(null); if (params.get("open")) router.replace("/memories"); }} title="Memory">
        {detail && (
          <div>
            <h3 className="te text-lg font-semibold">{detail.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone="brand">{detail.category}</Badge><Badge tone={PRI_TONE[detail.priority]}>{detail.priority} priority</Badge>{detail.pinned && <Badge><Pin className="h-3 w-3" />pinned</Badge>}{detail.archived && <Badge>archived</Badge>}</div>
            <p className="te mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{detail.content || "—"}</p>
            {detail.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{detail.tags.map((t) => <span key={t} className="chip"><Tag className="h-3 w-3" />{t}</span>)}</div>}
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-surface-2/60 p-3 text-xs text-muted">
              <div><Clock className="mr-1 inline h-3 w-3" />Created {fmt(detail.created_at, tz, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              <div>Last updated {fmt(detail.updated_at, tz, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              <div>Saved via {detail.source}</div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="danger" size="sm" onClick={() => remove(detail)}><Trash2 className="h-4 w-4" />Delete</Button>
              <Button variant="secondary" size="sm" onClick={() => patch(detail, { archived: !detail.archived, pinned: false }, detail.archived ? "Restored." : "Archived.")}>{detail.archived ? "Restore" : "Archive"}</Button>
              <Button size="sm" onClick={() => { setEditing(detail); setDetail(null); }}><Pencil className="h-4 w-4" />Edit</Button>
            </div>
          </div>
        )}
      </Modal>
      <MemoryEditor open={creating || !!editing} memory={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => reload()} />
      <VoiceCapture open={voice} onClose={() => setVoice(false)} onSaved={() => reload()} />
    </div>
  );
}

function IconBtn({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} aria-label={label} title={label} className={cn("rounded-md p-1.5 text-muted hover:bg-surface-2", danger ? "hover:text-danger" : "hover:text-fg")}>{children}</button>;
}

export default function MemoriesPage() {
  return <Suspense><MemoriesInner /></Suspense>;
}
