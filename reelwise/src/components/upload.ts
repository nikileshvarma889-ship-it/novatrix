import { api } from "./ui";

export async function upload(file: File, opts: { brandId?: string; purpose?: string } = {}) {
  const fd = new FormData();
  fd.set("file", file);
  if (opts.brandId) fd.set("brandId", opts.brandId);
  if (opts.purpose) fd.set("purpose", opts.purpose);
  return api<{ id: string; kind: string }>("/api/media", { method: "POST", body: fd });
}
