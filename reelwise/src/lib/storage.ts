// Local-disk media storage with strict upload validation. STORAGE_DIR can be a
// mounted volume; swap this module for S3/Supabase Storage in multi-server deploys.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { sql } from "./db";

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || "./storage");

export const UPLOAD_RULES: Record<string, { kind: "image" | "video" | "audio" | "font"; max: number }> = {
  "image/png": { kind: "image", max: 15e6 },
  "image/jpeg": { kind: "image", max: 15e6 },
  "image/webp": { kind: "image", max: 15e6 },
  "video/mp4": { kind: "video", max: 1e9 },
  "video/quicktime": { kind: "video", max: 1e9 },
  "video/webm": { kind: "video", max: 1e9 },
  "audio/mpeg": { kind: "audio", max: 60e6 },
  "audio/wav": { kind: "audio", max: 120e6 },
  "audio/x-wav": { kind: "audio", max: 120e6 },
  "audio/mp4": { kind: "audio", max: 60e6 },
  "font/ttf": { kind: "font", max: 5e6 },
  "font/otf": { kind: "font", max: 5e6 },
  "font/woff2": { kind: "font", max: 5e6 },
};

/** Check magic bytes so a renamed file can't pose as another type. */
export function sniff(buf: Buffer): string | null {
  const h = (n: number) => buf.subarray(0, n).toString("hex");
  if (h(8) === "89504e470d0a1a0a") return "image/png";
  if (h(3) === "ffd8ff") return "image/jpeg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WAVE") return "audio/wav";
  if (buf.subarray(4, 8).toString() === "ftyp") {
    const brand = buf.subarray(8, 12).toString();
    if (brand === "qt  ") return "video/quicktime";
    if (brand.startsWith("M4A")) return "audio/mp4";
    return "video/mp4";
  }
  if (h(4) === "1a45dfa3") return "video/webm";
  if (buf.subarray(0, 3).toString() === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (buf.subarray(0, 4).toString() === "wOF2") return "font/woff2";
  if (h(4) === "00010000") return "font/ttf";
  if (buf.subarray(0, 4).toString() === "OTTO") return "font/otf";
  return null;
}

export function absPath(rel: string) {
  const p = path.resolve(STORAGE_DIR, rel);
  if (!p.startsWith(STORAGE_DIR + path.sep)) throw new Error("Path escapes storage directory");
  return p;
}

export async function saveMedia(opts: {
  workspaceId: string;
  data: Buffer;
  filename: string;
  mime: string;
  kind: string;
  source?: string;
  brandId?: string | null;
  userId?: string | null;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
}) {
  const ext = path.extname(opts.filename).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8) || ".bin";
  const rel = path.join(opts.workspaceId, `${crypto.randomUUID()}${ext}`);
  fs.mkdirSync(path.dirname(absPath(rel)), { recursive: true });
  fs.writeFileSync(absPath(rel), opts.data);
  const safeName = path.basename(opts.filename).replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const [row] = await sql`insert into media (workspace_id, brand_id, kind, source, filename, mime, size, path, created_by, duration_sec, width, height)
    values (${opts.workspaceId}, ${opts.brandId ?? null}, ${opts.kind}, ${opts.source ?? "upload"}, ${safeName}, ${opts.mime}, ${opts.data.length}, ${rel}, ${opts.userId ?? null}, ${opts.durationSec ?? null}, ${opts.width ?? null}, ${opts.height ?? null})
    returning id`;
  return row.id as string;
}

/** Register a file already written under STORAGE_DIR (e.g. by the renderer). */
export async function registerFile(opts: { workspaceId: string; rel: string; filename: string; mime: string; kind: string; source: string; durationSec?: number; width?: number; height?: number }) {
  const size = fs.statSync(absPath(opts.rel)).size;
  const [row] = await sql`insert into media (workspace_id, kind, source, filename, mime, size, path, duration_sec, width, height)
    values (${opts.workspaceId}, ${opts.kind}, ${opts.source}, ${opts.filename}, ${opts.mime}, ${size}, ${opts.rel}, ${opts.durationSec ?? null}, ${opts.width ?? null}, ${opts.height ?? null}) returning id`;
  return row.id as string;
}
