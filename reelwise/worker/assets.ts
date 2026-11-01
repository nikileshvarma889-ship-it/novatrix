// Tiny loopback file server so the headless renderer can load media from
// STORAGE_DIR. Only files registered for the current render are served.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const files = new Map<string, string>();
let base = "";

export async function startAssetServer() {
  if (base) return base;
  const server = http.createServer((req, res) => {
    const key = (req.url ?? "").split("?")[0].slice(1).split("/")[0];
    const file = files.get(key);
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const type: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".mp4": "video/mp4", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf" };
    const stat = fs.statSync(file);
    const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
    const headers = { "content-type": type[ext] ?? "application/octet-stream", "access-control-allow-origin": "*", "accept-ranges": "bytes" };
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : stat.size - 1;
      res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${stat.size}`, "content-length": end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...headers, "content-length": stat.size });
      fs.createReadStream(file).pipe(res);
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return base;
}

export function serve(file: string) {
  const key = crypto.randomBytes(12).toString("hex");
  files.set(key, file);
  return `${base}/${key}/${path.basename(file)}`;
}
