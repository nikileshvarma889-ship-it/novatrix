// End-to-end workflow test against a running server + worker.
// Usage: BASE=http://localhost:3000 DATABASE_URL=... node tests/e2e.mjs
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sql = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
let pass = 0, fail = 0;
const ok = (cond, name, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  — ${extra}` : ""}`); };

function client() {
  let cookie = "";
  return async (path, { method = "GET", json, body, headers = {} } = {}) => {
    const res = await fetch(BASE + path, { method, headers: { ...(json ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers }, body: json ? JSON.stringify(json) : body, redirect: "manual" });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
}

const email = `e2e-${Date.now()}@example.com`;
const a = client();
const b = client();

// --- auth ---
ok((await a("/api/me")).status === 401, "API rejects requests without a session");
ok((await a("/api/auth/signup", { method: "POST", json: { name: "Ada", email, password: "short", workspace: "Ada Co" } })).status === 400, "signup validates password length");
ok((await a("/api/auth/signup", { method: "POST", json: { name: "Ada", email, password: "correct horse battery", workspace: "SwiftShip" } })).status === 200, "signup creates account + workspace");
const me = await a("/api/me");
ok(me.status === 200 && me.data.user.role === "owner", "session works; creator is owner");
ok((await b("/api/auth/login", { method: "POST", json: { email, password: "wrong password!!" } })).status === 401, "wrong password rejected");
const [{ password_hash }] = await sql`select password_hash from users where email = ${email}`;
ok(password_hash.startsWith("$2") && !password_hash.includes("correct"), "password stored as bcrypt hash");

// --- security ---
ok((await a("/api/brands", { method: "POST", json: {}, headers: { origin: "https://evil.example" } })).status === 403, "cross-site POST blocked (CSRF)");
let limited = false;
for (let i = 0; i < 10; i++) if ((await b("/api/auth/login", { method: "POST", json: { email: "nobody@example.com", password: "x" } })).status === 429) limited = true;
ok(limited, "login brute force is rate-limited");
const hdr = (await a("/login")).headers;
ok(hdr.get("x-frame-options") === "DENY" && (hdr.get("content-security-policy") ?? "").includes("frame-ancestors"), "security headers present");

// --- brand + upload ---
const brand = await a("/api/brands", { method: "POST", json: { name: "SwiftShip Couriers", description: "International courier from India to the USA", audience: "Indian small businesses", language: "English", video_style: "auto", colors: ["#ff7a1a", "#2b59ff", "#0f172a"], fonts: { heading: "Inter", body: "Inter" }, cta: "Book a pickup", website: "swiftship.example", duration_sec: 20, aspect_ratio: "9:16", intro_text: "", outro_text: "Anywhere. On time.", restrictions: "Never promise delivery times." } });
ok(brand.status === 201, "brand created");
ok((await a("/api/brands", { method: "POST", json: { name: "Bad", colors: ["red"], fonts: { heading: "a", body: "b" }, duration_sec: 20, aspect_ratio: "9:16" } })).status === 400, "brand input validated");
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0xff7a1a:s=256x256", "-frames:v", "1", "/tmp/e2e-logo.png"]);
const fd = new FormData(); fd.set("file", new Blob([fs.readFileSync("/tmp/e2e-logo.png")]), "logo.png"); fd.set("brandId", brand.data.id); fd.set("purpose", "logo");
const up = await a("/api/media", { method: "POST", body: fd });
ok(up.status === 201 && up.data.kind === "logo", "logo uploaded (type checked by file signature)");
const fake = new FormData(); fake.set("file", new Blob([Buffer.from("#!/bin/sh\nrm -rf /")]), "evil.png");
ok((await a("/api/media", { method: "POST", body: fake })).status === 415, "renamed non-image upload rejected");
await a(`/api/brands/${brand.data.id}`, { method: "PUT", json: { ...brand.data, logo_media_id: up.data.id, id: undefined, workspace_id: undefined, created_at: undefined, updated_at: undefined, music_media_id: null } });

// --- AI without key: clear message ---
const gen = await a("/api/content", { method: "POST", json: { kind: "hooks", tone: "funny", language: "Telugu", brandId: brand.data.id, topic: "courier service" } });
ok(gen.status === 400 && /API key/.test(gen.data.error), "AI features explain the missing AI key", gen.data.error);

// --- video with a hand-written storyboard (no AI key needed) ---
const scene = (id, kind, h, vo, extra = {}) => ({ id, kind, durationSec: 3, heading: h, subheading: "", bullets: [], voiceover: vo, camera: "static", imageMediaId: null, fromPlace: "", toPlace: "", characterColor: "", mood: "bright", ...extra });
const storyboard = { title: "SwiftShip in 6 seconds", style: "promo", hook: "", musicMood: "upbeat", caption: "Ship worldwide with SwiftShip.", hashtags: ["courier", "shipping"], youtubeTitle: "SwiftShip", youtubeDescription: "Worldwide courier", thumbnailText: "Ship worldwide",
  scenes: [scene("s1", "title", "Ship from India to the USA", "We pick up from your door."), scene("s2", "cta", "Book a pickup", "Book today.", { subheading: "Book a pickup" })] };
const created = await a("/api/videos", { method: "POST", json: { instruction: "A short promo for SwiftShip couriers", brandId: brand.data.id, style: "promo", aspectRatio: "9:16", durationSec: 6, voice: "warm-male", music: "mood:upbeat", storyboard } });
ok(created.status === 201, "video created");
const vid = created.data.id;
ok((await a(`/api/videos/${vid}/approve`, { method: "POST", json: { accountIds: [], scheduleAt: null, confirm: true } })).status !== 200, "cannot approve before the video is ready");
let v;
for (let i = 0; i < 120; i++) { v = (await a(`/api/videos/${vid}`)).data; if (["ready", "failed"].includes(v.status)) break; await new Promise((r) => setTimeout(r, 5000)); }
ok(v.status === "ready" && v.video_media_id && v.thumbnail_media_id, "draft video rendered with thumbnail", v.error ?? "");
const file = await a(`/api/media/${v.video_media_id}/file`, { headers: { range: "bytes=0-99" } });
ok(file.status === 206, "video streams with range requests (seekable player)");
const [m] = await sql`select path from media where id = ${v.video_media_id}`;
const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height", "-of", "csv=p=0", `${process.env.STORAGE_DIR ?? "./storage"}/${m.path}`], { encoding: "utf8" });
ok(/h264,540,960/.test(probe) && /aac/.test(probe), "MP4 is H.264 + AAC, 9:16", probe.replace(/\n/g, " "));

// --- isolation between workspaces ---
await b("/api/auth/signup", { method: "POST", json: { name: "Eve", email: `eve-${Date.now()}@example.com`, password: "another long password", workspace: "Eve Inc" } });
ok((await b(`/api/videos/${vid}`)).status === 404 && (await b(`/api/media/${v.video_media_id}/file`)).status === 404, "other workspaces cannot see this video or its file");

// --- approval → publish never fakes success ---
const { encrypt } = await import("../src/lib/crypto.ts").catch(() => ({ encrypt: null }));
const [{ id: wsId }] = await sql`select workspace_id as id from videos where id = ${vid}`;
const [acct] = await sql`insert into social_accounts (workspace_id, platform, external_id, name, access_token_enc, refresh_token_enc, token_expires_at)
  values (${wsId}, 'youtube', ${`UC-test-${Date.now()}`}, 'Test channel', ${encrypt ? encrypt("not-a-real-token") : "v1:x:x:x"}, null, now() + interval '1 hour') returning id`;
ok((await a(`/api/videos/${vid}/approve`, { method: "POST", json: { accountIds: [acct.id], scheduleAt: null } })).status === 400, "approval requires explicit confirmation");
const appr = await a(`/api/videos/${vid}/approve`, { method: "POST", json: { accountIds: [acct.id], scheduleAt: null, confirm: true } });
ok(appr.status === 200, "approve & publish accepted");
let pubs;
for (let i = 0; i < 160; i++) { pubs = (await a("/api/publications")).data.filter((p) => p.video_id === vid); if (pubs.every((p) => ["failed", "published"].includes(p.status) || /Retrying/.test(p.error ?? ""))) break; await new Promise((r) => setTimeout(r, 5000)); }
const [vf] = await sql`select render_quality from videos where id = ${vid}`;
ok(vf.render_quality === "final", "approval triggered the full 1080p render");
ok(pubs.length === 1 && pubs[0].status !== "published", "publishing with an invalid token is NOT marked Published", `${pubs[0]?.status}: ${pubs[0]?.error}`);

console.log(`\n${pass} passed, ${fail} failed`);
await sql.end();
process.exit(fail ? 1 : 0);
