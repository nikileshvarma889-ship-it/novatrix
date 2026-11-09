"use client";
import { useEffect, useState } from "react";
import { Check, Trash2, Wand2 } from "lucide-react";
import { AiLabel, Button, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { postJson } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { supabaseBrowser } from "@/lib/supabase/client";

type Card = { front: string; back: string; difficulty: "easy" | "medium" | "hard"; keep: boolean };
export type FlashRequest = { source: "text" | "note" | "document" | "video" | "chapter"; id?: string; text?: string; chapterId?: string; subject?: string };

/** Generates AI flashcards, lets the user edit / drop cards, and saves only the ones they keep. */
export function FlashcardPreview({ open, onClose, request, subject, chapterId, deck, sourceKind, onSaved }: { open: boolean; onClose: () => void; request: FlashRequest; subject?: string; chapterId?: string; deck?: string; sourceKind: "ai" | "note" | "document" | "video"; onSaved?: () => void }) {
  const toast = useToast();
  const { profile } = useProfile();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) setCards(null); }, [open]);
  const gen = async () => {
    setBusy(true);
    try {
      const r = await postJson<{ cards: Omit<Card, "keep">[] }>("/api/ai/flashcards", { ...request, count, language: profile.language_pref });
      setCards(r.cards.map((c) => ({ ...c, keep: true })));
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't generate flashcards.", "error"); }
    finally { setBusy(false); }
  };
  const save = async () => {
    const keep = (cards ?? []).filter((c) => c.keep && c.front.trim() && c.back.trim());
    if (!keep.length) return toast("No cards selected.", "info");
    setSaving(true);
    const { error } = await supabaseBrowser().from("flashcards").insert(keep.map((c) => ({ front: c.front.trim(), back: c.back.trim(), difficulty: c.difficulty, subject: subject ?? request.subject ?? null, chapter_id: chapterId ?? request.chapterId ?? null, deck: deck || "General", source: sourceKind })));
    setSaving(false);
    if (error) return toast(`Not saved: ${error.message}`, "error");
    toast(`Saved ${keep.length} flashcard${keep.length === 1 ? "" : "s"}.`);
    onSaved?.(); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Generate flashcards" wide>
      {!cards ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">{request.source === "chapter" ? "Cards are generated from standard textbook knowledge for this chapter." : "Cards are generated only from your own material."} You can edit or remove any card before saving.</p>
          <div className="flex items-center gap-3">
            <Select value={count} onChange={(e) => setCount(+e.target.value)} className="w-40">{[5, 10, 15, 20, 25].map((n) => <option key={n} value={n}>{n} cards</option>)}</Select>
            <Button onClick={gen} loading={busy}><Wand2 className="h-4 w-4" />Generate</Button>
          </div>
          {busy && <div className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" />Writing cards…</div>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between"><AiLabel /><span className="text-xs text-muted">{cards.filter((c) => c.keep).length} of {cards.length} selected</span></div>
          <div className="scrollbar-thin max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {cards.map((c, i) => (
              <div key={i} className={`grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto] ${c.keep ? "border-border" : "border-border/40 opacity-50"}`}>
                <Textarea value={c.front} onChange={(e) => setCards(cards.map((x, j) => (j === i ? { ...x, front: e.target.value } : x)))} className="te min-h-[64px] text-[13px]" aria-label="Front" />
                <Textarea value={c.back} onChange={(e) => setCards(cards.map((x, j) => (j === i ? { ...x, back: e.target.value } : x)))} className="te min-h-[64px] text-[13px]" aria-label="Back" />
                <div className="flex flex-row gap-1 sm:flex-col">
                  <button onClick={() => setCards(cards.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))} className={`rounded-lg p-2 ${c.keep ? "text-ok" : "text-subtle"} hover:bg-surface-2`} aria-label={c.keep ? "Exclude" : "Include"}>{c.keep ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => setCards(null)}>Regenerate</Button><Button onClick={save} loading={saving}>Save selected</Button></div>
        </div>
      )}
    </Modal>
  );
}
