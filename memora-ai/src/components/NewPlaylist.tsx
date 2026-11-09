"use client";
import { useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SUBJECTS } from "@/lib/utils";

export function NewPlaylist({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabaseBrowser().from("playlists").insert({ name: name.trim(), description: desc.trim(), subject: subject || null }).select("id").single();
    setBusy(false);
    if (error) return toast(error.message, "error");
    toast("Playlist created."); setName(""); setDesc(""); onSaved(data.id); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="New playlist">
      <form onSubmit={save} className="space-y-4">
        <Field label="Name"><Input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electrostatics revision" autoFocus /></Field>
        <Field label="Description"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-[60px]" /></Field>
        <Field label="Subject"><Select value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">—</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Create</Button></div>
      </form>
    </Modal>
  );
}

