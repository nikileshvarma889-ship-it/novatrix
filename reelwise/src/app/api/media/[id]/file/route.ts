import fs from "node:fs";
import { Readable } from "node:stream";
import { route, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { absPath } from "@/lib/storage";

/** Streams a workspace file with HTTP range support (needed for video seeking). */
export const GET = route<{ id: string }>({ limit: [600, 60_000] }, async ({ req, user, params }) => {
  const [m] = await sql`select path, mime, filename, size from media where id = ${params.id} and workspace_id = ${user.workspaceId}`;
  if (!m) throw new HttpError(404, "File not found.");
  const file = absPath(m.path);
  if (!fs.existsSync(file)) throw new HttpError(410, "The file is missing from storage.");
  const size = fs.statSync(file).size;
  const download = req.nextUrl.searchParams.get("download") === "1";
  const headers: Record<string, string> = {
    "content-type": m.mime,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=3600",
    "content-disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(m.filename)}"`,
  };
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, { headers: { ...headers, "content-length": String(size) } });
});
