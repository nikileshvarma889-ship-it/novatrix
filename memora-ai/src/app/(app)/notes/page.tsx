"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { FileText, FileUp, Heart, NotebookText, Pin, Plus, Search, Trash2, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Badge, Button, Empty, PageHeader, Select, Skeleton, Tabs } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useData, must, postJson } from "@/hooks/useData";
import { SUBJECTS, cn, subjectName, truncate } from "@/lib/utils";
import { relative } from "@/lib/dates";

type Note = { id: string; title: string; content: string; subject: string | null; tags: string[]; pinned: boolean; favourite: boolean; updated_at: string };
type Doc = { id: string; title: string; file_path: string; mime_type: string; size_bytes: number; page_count: number | null; subject: string | null; status: string; error: string | null; created_at: string };
const ACCEPT: Record<string, string> = { "application/pdf": "PDF", "text/plain": "TXT", "text/markdown": "MD", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX" };

function NotesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<"notes" | "documents">((params.get("tab") as "documents") || "notes");
  return (
    <div className="space-y-5">
      <PageHeader title="Notes & Documents" sub="Your digital notebook and study files — with AI that stays grounded in your material." icon={<NotebookText className="h-5 w-5" />}
        actions={tab === "notes" ? <Link href="/notes/new"><Button><Plus className="h-4 w-4" />New note</Button></Link> : null} />
      <Tabs tabs={[{ id: "notes", label: "Notes" }, { id: "documents", label: "Documents" }]} value={tab} onChange={(t) => { setTab(t); router.replace(`/notes?tab=${t}`, { scroll: false }); }} className="w-fit" />
      {tab === "notes" ? <NotesList /> : <Documents />}
    </div>
  );
}

function NotesList() {
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const [subject, setSubject] = useState("all");
  const [filter, setFilter] = useState("all");
  useEffect(() => { const id = setTimeout(() => setDeb(q.trim()), 250); return () => clearTimeout(id); }, [q]);
  const { data, loading } = useData(async () => {
    const sb = supabaseBrowser();
    if (deb) {
      const ids = (must(await sb.rpc("search_notes", { q: deb, lim: 50 })) as { id: string }[]).map((r) => r.id);
      if (!ids.length) return [] as Note[];
      const rows = must(await sb.from("notes").select("id,title,content,subject,tags,pinned,favourite,updated_at").in("id", ids)) as Note[];
      return ids.map((id) => rows.find((r) => r.id === id)!).filter(Boolean);
    }
    return must(await sb.from("notes").select("id,title,content,subject,tags,pinned,favourite,updated_at").order("pinned", { ascending: false }).order("updated_at", { ascending: false }).limit(500)) as Note[];
  }, [deb]);
  const list = useMemo(() => (data ?? []).filter((n) => (subject === "all" || (subject === "none" ? !n.subject : n.subject === subject)) && (filter === "all" || (filter === "pinned" ? n.pinned : n.favourite))), [data, subject, filter]);
  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-2 p-3 sm:flex-row">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" className="input pl-10" /></div>
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="sm:w-44"><option value="all">All subjects</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="none">No subject</option></Select>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:w-36"><option value="all">All notes</option><option value="pinned">Pinned</option><option value="fav">Favourites</option></Select>
      </div>
      {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div> : !list.length ? (
        <Empty icon={<NotebookText className="h-5 w-5" />} title={deb ? "No notes match" : "No notes yet"} text="Write class notes, formulas and doubts. Use AI to summarise them or turn them into flashcards." action={<Link href="/notes/new"><Button size="sm"><Plus className="h-4 w-4" />New note</Button></Link>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((n) => (
            <Link key={n.id} href={`/notes/${n.id}`} className={cn("card flex flex-col p-4 transition hover:border-brand/40", n.pinned && "border-brand/30")}>
              <div className="flex items-start justify-between gap-2"><h3 className="te line-clamp-2 font-semibold">{n.title}</h3><div className="flex shrink-0 gap-1">{n.pinned && <Pin className="h-4 w-4 fill-brand text-brand" />}{n.favourite && <Heart className="h-4 w-4 fill-danger text-danger" />}</div></div>
              <p className="te mt-1.5 line-clamp-4 flex-1 text-sm text-muted">{truncate(n.content.replace(/[#*_`>$\\]/g, ""), 220) || "Empty note"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">{n.subject && <Badge tone={SUBJECTS.find((s) => s.id === n.subject)?.color ?? "default"}>{subjectName(n.subject)}</Badge>}{n.tags.slice(0, 3).map((t) => <span key={t} className="chip">#{t}</span>)}<span className="ml-auto text-[11px] text-subtle">{relative(n.updated_at)}</span></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Documents() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const { data, loading, reload, setData } = useData(async () => must(await supabaseBrowser().from("documents").select("*").order("created_at", { ascending: false })) as Doc[]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    for (const file of Array.from(files)) {
      const type = file.type || (file.name.endsWith(".md") ? "text/markdown" : file.name.endsWith(".txt") ? "text/plain" : "");
      if (!ACCEPT[type]) { toast(`${file.name}: only PDF, TXT, MD or DOCX files are supported.`, "error"); continue; }
      if (file.size > 20 * 1024 * 1024) { toast(`${file.name} is larger than 20 MB.`, "error"); continue; }
      setUploading(file.name);
      const path = `${u.user!.id}/documents/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await sb.storage.from("user-files").upload(path, file, { contentType: type });
      if (up.error) { toast(`Upload failed: ${up.error.message}`, "error"); continue; }
      const ins = await sb.from("documents").insert({ title: file.name.replace(/\.[^.]+$/, "").slice(0, 200), file_path: path, mime_type: type, size_bytes: file.size, subject: subject || null }).select("*").single();
      if (ins.error) { await sb.storage.from("user-files").remove([path]); toast(`Couldn't save ${file.name}: ${ins.error.message}`, "error"); continue; }
      setData((d) => [ins.data as Doc, ...(d ?? [])]);
      if (type !== ACCEPT_DOCX) {
        postJson("/api/documents/process", { documentId: ins.data.id }).then(() => toast(`${file.name} is ready for AI.`)).catch((e) => toast(`${file.name}: ${e.message}`, "error")).finally(reload);
      } else {
        await sb.from("documents").update({ status: "failed", error: "Stored safely. AI reading supports PDF and TXT files — export DOCX to PDF for AI features." }).eq("id", ins.data.id);
        reload();
      }
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
  };
  const remove = async (d: Doc) => {
    if (!confirm(`Delete “${d.title}” and its file?`)) return;
    const sb = supabaseBrowser();
    await sb.storage.from("user-files").remove([d.file_path]);
    const { error } = await sb.from("documents").delete().eq("id", d.id);
    if (error) return toast(error.message, "error");
    setData((x) => x?.filter((y) => y.id !== d.id) ?? x);
  };
  return (
    <div className="space-y-4">
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
        className="card flex flex-col items-center gap-3 border-dashed p-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">{uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}</div>
        <div><div className="font-medium">{uploading ? `Uploading ${uploading}…` : "Drop study files here"}</div><div className="text-sm text-muted">PDF, TXT, MD or DOCX up to 20 MB · stored privately in your account</div></div>
        <div className="flex flex-wrap justify-center gap-2">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-44"><option value="">No subject</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md,.docx" className="hidden" onChange={(e) => upload(e.target.files)} />
          <Button onClick={() => fileRef.current?.click()} disabled={!!uploading}><FileUp className="h-4 w-4" />Choose files</Button>
        </div>
      </div>
      {loading ? <Skeleton className="h-40" /> : !data?.length ? <Empty icon={<FileText className="h-5 w-5" />} title="No documents yet" text="Upload textbook chapters, class notes or question banks. Then summarise them or ask questions with page references." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((d) => (
            <div key={d.id} className="card flex items-center gap-3 p-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-xs font-bold text-brand">{ACCEPT[d.mime_type] ?? "FILE"}</div>
              <Link href={`/documents/${d.id}`} className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.title}</div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span>{(d.size_bytes / 1024 / 1024).toFixed(1)} MB</span>{d.page_count ? <span>{d.page_count} pages</span> : null}{d.subject && <span>{subjectName(d.subject)}</span>}<span>{relative(d.created_at)}</span>
                </div>
                <div className="mt-1 text-xs">{d.status === "ready" ? <span className="text-ok"><CheckCircle2 className="mr-1 inline h-3 w-3" />Ready for AI</span> : d.status === "failed" ? <span className="text-warn"><AlertCircle className="mr-1 inline h-3 w-3" />{truncate(d.error ?? "Couldn't be read", 80)}</span> : <span className="text-muted"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Processing…</span>}</div>
              </Link>
              <button onClick={() => remove(d)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-danger" aria-label="Delete document"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const ACCEPT_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function NotesPage() {
  return <Suspense><NotesInner /></Suspense>;
}
