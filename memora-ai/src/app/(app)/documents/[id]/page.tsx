"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, ExternalLink, FileText, ListChecks, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button, Card, Empty, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { AiMaterial } from "@/components/AiMaterial";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useData, postJson } from "@/hooks/useData";
import { subjectName } from "@/lib/utils";
import { fmt } from "@/lib/dates";
import { useProfile } from "@/hooks/useProfile";

type Doc = { id: string; title: string; file_path: string; mime_type: string; size_bytes: number; page_count: number | null; subject: string | null; status: string; error: string | null; summary: string | null; created_at: string };

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { profile } = useProfile();
  const [url, setUrl] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const { data: doc, loading, reload } = useData(async () => (await supabaseBrowser().from("documents").select("*").eq("id", id).maybeSingle()).data as Doc | null, [id]);
  useEffect(() => {
    if (!doc) return;
    supabaseBrowser().storage.from("user-files").createSignedUrl(doc.file_path, 60 * 30).then(({ data }) => setUrl(data?.signedUrl ?? null));
    if (doc.status === "processing" || doc.status === "uploaded") { const t = setTimeout(reload, 3000); return () => clearTimeout(t); }
  }, [doc, reload]);
  const retry = async () => {
    setRetrying(true);
    try { await postJson("/api/documents/process", { documentId: id }); toast("Document processed."); } catch (e) { toast(e instanceof Error ? e.message : "Processing failed.", "error"); }
    finally { setRetrying(false); reload(); }
  };
  if (loading && !doc) return <Skeleton className="h-96" />;
  if (!doc) return <Empty icon={<FileText className="h-5 w-5" />} title="Document not found" action={<Link href="/notes?tab=documents"><Button size="sm" variant="secondary">Back to documents</Button></Link>} />;
  return (
    <div className="space-y-4">
      <Link href="/notes?tab=documents" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />Documents</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="h-page">{doc.title}</h1><p className="mt-1 text-sm text-muted">{subjectName(doc.subject)} · {doc.page_count ? `${doc.page_count} pages · ` : ""}{(doc.size_bytes / 1048576).toFixed(1)} MB · uploaded {fmt(doc.created_at, profile.timezone)}</p></div>
        <div className="flex gap-2">
          <Link href={`/quizzes?doc=${doc.id}&subject=${doc.subject ?? ""}`}><Button variant="secondary" disabled={doc.status !== "ready"}><ListChecks className="h-4 w-4" />Quiz from this</Button></Link>
          {url && <a href={url} target="_blank" rel="noopener noreferrer"><Button variant="secondary"><ExternalLink className="h-4 w-4" />Open file</Button></a>}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_460px]">
        <Card className="h-fit">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-brand" />Document intelligence</h2>
          {doc.status === "ready" ? <AiMaterial kind="document" id={doc.id} title={doc.title} subject={doc.subject} initialSummary={doc.summary} /> :
            doc.status === "failed" ? (
              <div className="space-y-3"><div className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{doc.error}</div>{doc.mime_type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && <Button variant="secondary" onClick={retry} loading={retrying}><RefreshCw className="h-4 w-4" />Try again</Button>}</div>
            ) : <div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />Reading and indexing your document…</div>}
          <p className="mt-4 text-[11px] text-subtle">Answers use only this document and cite page numbers. If something isn&apos;t in the file, MEMORA says so.</p>
        </Card>
        <Card className="hidden h-[75vh] overflow-hidden p-0 xl:block">
          {url && doc.mime_type === "application/pdf" ? <iframe src={url} title={doc.title} className="h-full w-full bg-white" /> : <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">Preview is available for PDF files. Use “Open file” to view this document.</div>}
        </Card>
      </div>
    </div>
  );
}
