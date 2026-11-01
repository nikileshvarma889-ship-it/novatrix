import { route, json, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { saveMedia, sniff, UPLOAD_RULES } from "@/lib/storage";
import { audit } from "@/lib/audit";

export const GET = route({}, async ({ req, user }) => {
  const brand = req.nextUrl.searchParams.get("brandId");
  const kind = req.nextUrl.searchParams.get("kind");
  const rows = await sql`select id, brand_id, kind, source, filename, mime, size, width, height, duration_sec, created_at from media
    where workspace_id = ${user.workspaceId} ${brand ? sql`and brand_id = ${brand}` : sql``} ${kind ? sql`and kind = ${kind}` : sql``}
    and source <> 'voiceover' order by created_at desc limit 300`;
  return json(rows);
});

export const POST = route({ min: "editor", limit: [60, 60_000] }, async ({ req, user, ip }) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a file to upload.");
  const brandId = (form.get("brandId") as string) || null;
  const asLogo = form.get("purpose") === "logo";
  if (brandId) {
    const [b] = await sql`select 1 from brands where id = ${brandId} and workspace_id = ${user.workspaceId}`;
    if (!b) throw new HttpError(404, "Brand not found.");
  }
  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniff(data);
  const rule = mime ? UPLOAD_RULES[mime] : undefined;
  if (!mime || !rule) throw new HttpError(415, "Unsupported file. Upload PNG, JPG, WEBP, MP4, MOV, WEBM, MP3, WAV, M4A or a font (TTF/OTF/WOFF2).");
  if (data.length > rule.max) throw new HttpError(413, `File too large. The limit for ${rule.kind} files is ${Math.round(rule.max / 1e6)} MB.`);
  const id = await saveMedia({ workspaceId: user.workspaceId, data, filename: file.name, mime, kind: asLogo ? "logo" : rule.kind, brandId, userId: user.id });
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "media.upload", targetType: "media", targetId: id, ip, meta: { mime, size: data.length } });
  return json({ id, kind: asLogo ? "logo" : rule.kind, mime }, 201);
});
