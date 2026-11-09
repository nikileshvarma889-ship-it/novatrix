"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, Flame, Heart, Layers, Pencil, Plus, RotateCcw, Sparkles, Star, Trash2, Trophy, Wand2, X } from "lucide-react";
import { Badge, Button, Card, CardTitle, Empty, Field, Input, Modal, PageHeader, Select, Skeleton, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Markdown } from "@/components/Markdown";
import { FlashcardPreview, type FlashRequest } from "@/components/FlashcardPreview";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useData, must } from "@/hooks/useData";
import { RATINGS, isDifficult, review } from "@/lib/srs";
import { SUBJECTS, cn, subjectName } from "@/lib/utils";
import { CHAPTERS } from "@/lib/syllabus";
import { relative } from "@/lib/dates";

type FC = { id: string; front: string; back: string; subject: string | null; chapter_id: string | null; deck: string; favourite: boolean; difficulty: "easy" | "medium" | "hard"; source: string; srs_state: string; ease: number; interval_days: number; repetitions: number; lapses: number; due_at: string; last_reviewed_at: string | null; created_at: string };

function FlashInner() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState({ subject: "all", deck: "all", state: "all", fav: false });
  const [session, setSession] = useState<FC[] | null>(null);
  const [edit, setEdit] = useState<FC | null>(null);
  const [create, setCreate] = useState(false);
  const [gen, setGen] = useState<{ req: FlashRequest; subject?: string; chapterId?: string; deck?: string } | null>(null);
  const [genForm, setGenForm] = useState(false);

  const { data, loading, reload, setData } = useData(async () => must(await supabaseBrowser().from("flashcards").select("*").order("due_at").limit(5000)) as FC[]);
  const cards = useMemo(() => data ?? [], [data]);
  const now = new Date();
  const due = cards.filter((c) => new Date(c.due_at) <= now);
  const stats = { total: cards.length, new: cards.filter((c) => c.srs_state === "new").length, learning: cards.filter((c) => c.srs_state === "learning").length, review: cards.filter((c) => c.srs_state === "review").length, mastered: cards.filter((c) => c.srs_state === "mastered").length, difficult: cards.filter((c) => isDifficult(c)).length };
  const decks = Array.from(new Set(cards.map((c) => c.deck))).sort();
  const list = cards.filter((c) => (filter.subject === "all" || c.subject === filter.subject) && (filter.deck === "all" || c.deck === filter.deck) && (!filter.fav || c.favourite)
    && (filter.state === "all" || (filter.state === "difficult" ? isDifficult(c) : filter.state === "due" ? new Date(c.due_at) <= now : c.srs_state === filter.state)));

  // Daily recommendation: all due reviews first (difficult ones first), then up to 10 new cards.
  const recommended = useMemo(() => {
    const d = cards.filter((c) => new Date(c.due_at) <= new Date() && c.srs_state !== "new").sort((a, b) => Number(isDifficult(b)) - Number(isDifficult(a)) || a.due_at.localeCompare(b.due_at));
    const n = cards.filter((c) => c.srs_state === "new").slice(0, 10);
    return [...d, ...n];
  }, [cards]);

  useEffect(() => {
    if (loading) return;
    if (params.get("review") && recommended.length && !session) setSession(recommended);
    const g = params.get("generate");
    if (g) { const ch = CHAPTERS.find((c) => c.id === g); if (ch) setGen({ req: { source: "chapter", chapterId: ch.id }, subject: ch.subject, chapterId: ch.id, deck: ch.title }); router.replace("/flashcards"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const fav = async (c: FC) => {
    const { error } = await supabaseBrowser().from("flashcards").update({ favourite: !c.favourite }).eq("id", c.id);
    if (error) return toast(error.message, "error");
    setData((d) => d?.map((x) => (x.id === c.id ? { ...x, favourite: !c.favourite } : x)) ?? d);
  };
  const del = async (c: FC) => {
    if (!confirm("Delete this flashcard?")) return;
    const { error } = await supabaseBrowser().from("flashcards").delete().eq("id", c.id);
    if (error) return toast(error.message, "error");
    setData((d) => d?.filter((x) => x.id !== c.id) ?? d);
  };

  if (session) return <ReviewSession cards={session} onExit={() => { setSession(null); reload(); router.replace("/flashcards"); }} />;

  return (
    <div className="space-y-5">
      <PageHeader title="Flashcards" sub="Spaced repetition: review each card just before you'd forget it." icon={<Layers className="h-5 w-5" />}
        actions={<><Button variant="secondary" onClick={() => setGenForm(true)}><Wand2 className="h-4 w-4" />Generate with AI</Button><Button onClick={() => setCreate(true)}><Plus className="h-4 w-4" />New card</Button></>} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
          <CardTitle icon={<Flame className="h-4 w-4" />} title="Today's revision" sub="Recommended from your review schedule" />
          {loading ? <Skeleton className="h-20" /> : recommended.length ? (
            <div className="relative flex flex-wrap items-center gap-5">
              <div><div className="text-4xl font-bold">{recommended.length}</div><div className="text-sm text-muted">cards — about {Math.max(1, Math.round(recommended.length * 0.25))} min</div></div>
              <div className="flex flex-wrap gap-1.5 text-xs"><Badge tone="warn">{due.filter((c) => c.srs_state !== "new").length} due reviews</Badge><Badge tone="brand">{Math.min(10, stats.new)} new</Badge>{stats.difficult > 0 && <Badge tone="danger">{stats.difficult} difficult</Badge>}</div>
              <Button className="sm:ml-auto" onClick={() => setSession(recommended)}><Brain className="h-4 w-4" />Start review</Button>
            </div>
          ) : <div className="relative flex items-center gap-3 text-sm text-muted"><Trophy className="h-8 w-8 text-ok" />{stats.total ? "All caught up! Come back later for your next reviews." : "Create or generate cards to start your daily revision."}</div>}
        </Card>
        <Card>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["New", stats.new, "text-brand"], ["Learning", stats.learning, "text-warn"], ["Review", stats.review, "text-phys"], ["Difficult", stats.difficult, "text-danger"], ["Mastered", stats.mastered, "text-ok"], ["Total", stats.total, "text-fg"]].map(([l, n, c]) => (
              <button key={l as string} onClick={() => setFilter({ ...filter, state: l === "Total" ? "all" : (l as string).toLowerCase() })} className="rounded-xl bg-surface-2/50 py-2.5 hover:bg-surface-2"><div className={cn("text-xl font-bold", c as string)}>{n as number}</div><div className="text-[11px] text-muted">{l}</div></button>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })} className="w-40"><option value="all">All subjects</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        <Select value={filter.deck} onChange={(e) => setFilter({ ...filter, deck: e.target.value })} className="w-52"><option value="all">All decks / chapters</option>{decks.map((d) => <option key={d}>{d}</option>)}</Select>
        <Select value={filter.state} onChange={(e) => setFilter({ ...filter, state: e.target.value })} className="w-40"><option value="all">Any status</option><option value="due">Due now</option><option value="new">New</option><option value="learning">Learning</option><option value="review">Review</option><option value="difficult">Difficult</option><option value="mastered">Mastered</option></Select>
        <Button variant={filter.fav ? "secondary" : "ghost"} onClick={() => setFilter({ ...filter, fav: !filter.fav })}><Heart className={cn("h-4 w-4", filter.fav && "fill-danger text-danger")} />Favourites</Button>
        {list.length > 0 && <Button variant="outline" className="ml-auto" onClick={() => setSession(list)}><RotateCcw className="h-4 w-4" />Study these {list.length}</Button>}
      </div>

      {loading ? <Skeleton className="h-60" /> : !list.length ? <Empty icon={<Layers className="h-5 w-5" />} title="No flashcards here" text="Make cards yourself, or generate them from a chapter, your notes, documents or video notes." action={<Button size="sm" onClick={() => setGenForm(true)}><Wand2 className="h-4 w-4" />Generate with AI</Button>} /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.slice(0, 300).map((c) => (
            <Card key={c.id} className="group flex flex-col p-4">
              <div className="te line-clamp-3 text-[14.5px] font-medium"><Markdown className="[&_p]:my-0">{c.front}</Markdown></div>
              <div className="te mt-2 line-clamp-3 flex-1 text-sm text-muted"><Markdown className="text-muted [&_p]:my-0">{c.back}</Markdown></div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5">
                <Badge tone={c.srs_state === "mastered" ? "ok" : c.srs_state === "review" ? "phys" : c.srs_state === "learning" ? "warn" : "brand"}>{c.srs_state}</Badge>
                {isDifficult(c) && <Badge tone="danger">difficult</Badge>}
                {c.source !== "manual" && <Badge>✦ {c.source === "ai" ? "AI" : `from ${c.source}`}</Badge>}
                <span className="truncate text-[11px] text-subtle">{c.deck}</span>
                <span className="ml-auto text-[11px] text-subtle">{new Date(c.due_at) <= now ? "due" : relative(c.due_at)}</span>
              </div>
              <div className="mt-2 flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100">
                <button onClick={() => fav(c)} className="rounded-md p-1.5 text-muted hover:text-danger" aria-label="Favourite"><Heart className={cn("h-4 w-4", c.favourite && "fill-danger text-danger")} /></button>
                <button onClick={() => setEdit(c)} className="rounded-md p-1.5 text-muted hover:text-fg" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => del(c)} className="rounded-md p-1.5 text-muted hover:text-danger" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CardEditor open={create || !!edit} card={edit} decks={decks} onClose={() => { setCreate(false); setEdit(null); }} onSaved={reload} />
      <GenerateForm open={genForm} onClose={() => setGenForm(false)} onPick={(g) => { setGenForm(false); setGen(g); }} />
      {gen && <FlashcardPreview open onClose={() => setGen(null)} request={gen.req} subject={gen.subject} chapterId={gen.chapterId} deck={gen.deck} sourceKind={gen.req.source === "chapter" || gen.req.source === "text" ? "ai" : (gen.req.source as "note" | "document" | "video")} onSaved={reload} />}
    </div>
  );
}

function ReviewSession({ cards, onExit }: { cards: FC[]; onExit: () => void }) {
  const toast = useToast();
  const [queue, setQueue] = useState(cards);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState({ n: 0, again: 0 });
  const c = queue[i];
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); }
      if (flipped && ["1", "2", "3", "4"].includes(e.key)) rate((+e.key - 1) as 0 | 1 | 2 | 3);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const rate = async (r: 0 | 1 | 2 | 3) => {
    if (!c) return;
    const upd = review(c, r);
    const sb = supabaseBrowser();
    const [a, b] = await Promise.all([sb.from("flashcards").update(upd).eq("id", c.id), sb.from("flashcard_reviews").insert({ flashcard_id: c.id, rating: r })]);
    if (a.error || b.error) { toast(`Not recorded: ${(a.error ?? b.error)!.message}`, "error"); return; }
    setDone((d) => ({ n: d.n + 1, again: d.again + (r === 0 ? 1 : 0) }));
    if (r === 0) setQueue((q) => [...q, { ...c, ...upd }]);       // see it again in this session
    setFlipped(false);
    setI((x) => x + 1);
  };
  const progress = Math.min(100, (i / Math.max(1, queue.length)) * 100);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label="End review"><X className="h-5 w-5" /></Button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><motion.div className="h-full bg-brand-grad" animate={{ width: `${progress}%` }} /></div>
        <span className="text-sm text-muted tabular-nums">{Math.min(i, queue.length)}/{queue.length}</span>
      </div>
      {!c ? (
        <Card className="py-12 text-center">
          <Trophy className="mx-auto h-12 w-12 text-ok" />
          <h2 className="mt-4 text-xl font-semibold">Session complete!</h2>
          <p className="mt-1 text-sm text-muted">{done.n} reviews · {done.again} card{done.again === 1 ? "" : "s"} needed another look. Your next reviews are scheduled automatically.</p>
          <Button className="mt-6" onClick={onExit}>Done</Button>
        </Card>
      ) : (
        <>
          <AnimatePresence mode="wait">
            <motion.div key={c.id + i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.2 }}>
              <div className={cn("flip cursor-pointer select-none", flipped && "flipped")} onClick={() => setFlipped((f) => !f)} role="button" aria-label={flipped ? "Show question" : "Show answer"}>
                <div className="flip-inner relative min-h-[300px]">
                  <div className="flip-face card absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                    <div className="mb-3 flex gap-1.5"><Badge tone="brand">{c.deck}</Badge>{c.subject && <Badge>{subjectName(c.subject)}</Badge>}</div>
                    <div className="te text-xl font-medium"><Markdown className="text-xl [&_p]:my-1">{c.front}</Markdown></div>
                    <div className="mt-6 text-xs text-subtle">Tap or press Space to reveal</div>
                  </div>
                  <div className="flip-face flip-back card absolute inset-0 flex flex-col items-center justify-center border-brand/40 p-8 text-center">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand">Answer</div>
                    <div className="te text-lg"><Markdown className="text-lg [&_p]:my-1">{c.back}</Markdown></div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className={cn("grid grid-cols-4 gap-2 transition", !flipped && "pointer-events-none opacity-30")}>
            {RATINGS.map((r) => (
              <button key={r.v} onClick={() => rate(r.v)} className={cn("rounded-xl border px-2 py-3 text-center transition hover:-translate-y-0.5", r.v === 0 ? "border-danger/40 hover:bg-danger/10" : r.v === 1 ? "border-warn/40 hover:bg-warn/10" : r.v === 2 ? "border-ok/40 hover:bg-ok/10" : "border-brand/40 hover:bg-brand/10")}>
                <div className="text-sm font-semibold">{r.label}</div><div className="text-[10px] text-muted">key {r.v + 1}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CardEditor({ open, card, decks, onClose, onSaved }: { open: boolean; card: FC | null; decks: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ front: "", back: "", subject: "", chapter_id: "", deck: "General", difficulty: "medium" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ front: card?.front ?? "", back: card?.back ?? "", subject: card?.subject ?? "", chapter_id: card?.chapter_id ?? "", deck: card?.deck ?? "General", difficulty: card?.difficulty ?? "medium" }); }, [open, card]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const row = { front: f.front.trim(), back: f.back.trim(), subject: f.subject || null, chapter_id: f.chapter_id || null, deck: f.deck.trim() || "General", difficulty: f.difficulty };
    const sb = supabaseBrowser();
    const { error } = card ? await sb.from("flashcards").update(row).eq("id", card.id) : await sb.from("flashcards").insert({ ...row, source: "manual" });
    setBusy(false);
    if (error) return toast(error.message, "error");
    toast(card ? "Card updated." : "Card created."); onSaved(); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={card ? "Edit flashcard" : "New flashcard"}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Front (question)" hint="Supports $LaTeX$ for formulas."><Textarea required value={f.front} onChange={(e) => setF({ ...f, front: e.target.value })} className="te" /></Field>
        <Field label="Back (answer)"><Textarea required value={f.back} onChange={(e) => setF({ ...f, back: e.target.value })} className="te" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject"><Select value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value, chapter_id: "" })}><option value="">—</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Chapter"><Select value={f.chapter_id} onChange={(e) => setF({ ...f, chapter_id: e.target.value, deck: CHAPTERS.find((c) => c.id === e.target.value)?.title ?? f.deck })} disabled={!f.subject}><option value="">—</option>{CHAPTERS.filter((c) => c.subject === f.subject).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
          <Field label="Deck"><Input value={f.deck} onChange={(e) => setF({ ...f, deck: e.target.value })} list="decks" maxLength={80} /><datalist id="decks">{decks.map((d) => <option key={d} value={d} />)}</datalist></Field>
          <Field label="Difficulty"><Select value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select></Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
      </form>
    </Modal>
  );
}

function GenerateForm({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (g: { req: FlashRequest; subject?: string; chapterId?: string; deck?: string }) => void }) {
  const [src, setSrc] = useState<"chapter" | "text" | "note" | "document">("chapter");
  const [subject, setSubject] = useState("physics");
  const [chapter, setChapter] = useState("");
  const [text, setText] = useState("");
  const [pick, setPick] = useState("");
  const { data: items } = useData(async () => {
    if (!open || (src !== "note" && src !== "document")) return [];
    const sb = supabaseBrowser();
    return src === "note" ? must(await sb.from("notes").select("id,title,subject").order("updated_at", { ascending: false }).limit(200)) as { id: string; title: string; subject: string | null }[]
      : must(await sb.from("documents").select("id,title,subject").eq("status", "ready").order("created_at", { ascending: false })) as { id: string; title: string; subject: string | null }[];
  }, [open, src]);
  const go = () => {
    if (src === "chapter") { const ch = CHAPTERS.find((c) => c.id === chapter); if (ch) onPick({ req: { source: "chapter", chapterId: ch.id }, subject: ch.subject, chapterId: ch.id, deck: ch.title }); }
    else if (src === "text") onPick({ req: { source: "text", text }, deck: "My text" });
    else { const it = items?.find((x) => x.id === pick); if (it) onPick({ req: { source: src, id: it.id }, subject: it.subject ?? undefined, deck: it.title.slice(0, 80) }); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Generate flashcards with AI">
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-1.5">{(["chapter", "note", "document", "text"] as const).map((s) => <button key={s} onClick={() => setSrc(s)} className={cn("rounded-xl border py-2 text-xs font-medium capitalize", src === s ? "border-brand/50 bg-brand/10 text-brand" : "border-border text-muted")}>{s === "text" ? "Paste text" : s}</button>)}</div>
        {src === "chapter" && <div className="grid grid-cols-2 gap-3"><Field label="Subject"><Select value={subject} onChange={(e) => { setSubject(e.target.value); setChapter(""); }}>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field><Field label="Chapter"><Select value={chapter} onChange={(e) => setChapter(e.target.value)}><option value="">Choose…</option>{CHAPTERS.filter((c) => c.subject === subject).map((c) => <option key={c.id} value={c.id}>{c.paper} · {c.title}</option>)}</Select></Field></div>}
        {src === "text" && <Field label="Your text"><Textarea value={text} onChange={(e) => setText(e.target.value)} className="te min-h-[160px]" placeholder="Paste class notes, a textbook paragraph…" maxLength={20000} /></Field>}
        {(src === "note" || src === "document") && <Field label={src === "note" ? "Note" : "Document (ready for AI)"}><Select value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Choose…</option>{(items ?? []).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</Select></Field>}
        <p className="text-xs text-muted"><Sparkles className="mr-1 inline h-3 w-3" />{src === "chapter" ? "Uses standard textbook knowledge for the chapter." : "Uses only the material you choose."} You review every card before saving. <Star className="ml-1 inline h-3 w-3" /></p>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={src === "chapter" ? !chapter : src === "text" ? text.trim().length < 40 : !pick}>Continue</Button></div>
      </div>
    </Modal>
  );
}

export default function FlashcardsPage() {
  return <Suspense><FlashInner /></Suspense>;
}
