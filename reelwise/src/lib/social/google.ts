// Google OAuth + YouTube Data API v3 + YouTube Analytics API.
import fs from "node:fs";
import crypto from "node:crypto";
import { PlatformError } from "./errors";

const CFG = () => {
  const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new PlatformError("youtube", "Google is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see docs/SETUP_GOOGLE.md).");
  return { id, secret };
};
export const GOOGLE_REDIRECT = () => `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/oauth/google/callback`;
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authUrl(state: string, challenge: string) {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", CFG().id);
  u.searchParams.set("redirect_uri", GOOGLE_REDIRECT());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

type TokenRes = { access_token: string; refresh_token?: string; expires_in: number; scope: string; error?: string; error_description?: string };

async function tokenCall(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  const data = (await res.json()) as TokenRes;
  if (!res.ok) {
    const expired = data.error === "invalid_grant";
    throw new PlatformError("youtube", expired ? "Google access was revoked or expired. Reconnect the channel." : `Google OAuth error: ${data.error_description ?? data.error}`, data.error, expired);
  }
  return data;
}

export const exchangeCode = (code: string, verifier: string) =>
  tokenCall({ code, code_verifier: verifier, client_id: CFG().id, client_secret: CFG().secret, redirect_uri: GOOGLE_REDIRECT(), grant_type: "authorization_code" });
export const refresh = (refreshToken: string) => tokenCall({ refresh_token: refreshToken, client_id: CFG().id, client_secret: CFG().secret, grant_type: "refresh_token" });

export async function yt<T = Record<string, unknown>>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: number; message?: string; errors?: { reason?: string }[] } };
  if (!res.ok || data.error) {
    const reason = data.error?.errors?.[0]?.reason;
    let msg = `YouTube API error (${res.status}): ${data.error?.message ?? "unknown"}`;
    if (res.status === 401) msg = "YouTube access expired. Reconnect the channel.";
    if (reason === "quotaExceeded") msg = "The YouTube API daily quota is used up. The job will retry tomorrow.";
    if (reason === "insufficientPermissions" || res.status === 403) msg = `YouTube denied permission (${reason ?? res.status}). Reconnect and grant all requested scopes.`;
    if (reason === "uploadLimitExceeded") msg = "This channel reached YouTube's upload limit.";
    throw new PlatformError("youtube", msg, reason ?? res.status, res.status === 401);
  }
  return data as T;
}

export async function myChannel(token: string) {
  const r = await yt<{ items?: { id: string; snippet: { title: string; thumbnails?: { default?: { url: string } } }; statistics?: Record<string, string> }[] }>(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    token,
  );
  if (!r.items?.length) throw new PlatformError("youtube", "This Google account has no YouTube channel. Create one at youtube.com first.");
  return r.items[0];
}

/** Resumable upload. Returns only after YouTube confirms the upload. */
export async function uploadVideo(token: string, filePath: string, meta: { title: string; description: string; tags: string[]; privacy: "public" | "unlisted" | "private"; publishAt?: string }) {
  const size = fs.statSync(filePath).size;
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8", "X-Upload-Content-Length": String(size), "X-Upload-Content-Type": "video/mp4" },
    body: JSON.stringify({
      snippet: { title: meta.title.slice(0, 100), description: meta.description.slice(0, 5000), tags: meta.tags.slice(0, 30), categoryId: "22" },
      status: { privacyStatus: meta.publishAt ? "private" : meta.privacy, publishAt: meta.publishAt, selfDeclaredMadeForKids: false },
    }),
  });
  if (!init.ok) throw new PlatformError("youtube", `YouTube refused the upload (HTTP ${init.status}): ${(await init.text()).slice(0, 300)}`, init.status, init.status === 401);
  const location = init.headers.get("location");
  if (!location) throw new PlatformError("youtube", "YouTube did not return an upload URL.");
  const put = await fetch(location, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "content-type": "video/mp4", "content-length": String(size) }, body: fs.readFileSync(filePath) });
  const video = (await put.json().catch(() => ({}))) as { id?: string; status?: { uploadStatus?: string; rejectionReason?: string; failureReason?: string } };
  if (!put.ok || !video.id) throw new PlatformError("youtube", `YouTube upload failed (HTTP ${put.status}).`);
  if (video.status?.uploadStatus === "rejected" || video.status?.uploadStatus === "failed")
    throw new PlatformError("youtube", `YouTube ${video.status.uploadStatus} the video: ${video.status.rejectionReason ?? video.status.failureReason}`);
  return { externalId: video.id, url: `https://www.youtube.com/watch?v=${video.id}` };
}

export async function setThumbnail(token: string, videoId: string, imagePath: string, mime: string) {
  await yt(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, token, {
    method: "POST",
    headers: { "content-type": mime },
    body: fs.readFileSync(imagePath),
  });
}

export async function channelAnalytics(token: string, start: string, end: string) {
  const u = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  u.searchParams.set("ids", "channel==MINE");
  u.searchParams.set("startDate", start);
  u.searchParams.set("endDate", end);
  u.searchParams.set("metrics", "views,likes,comments,shares,estimatedMinutesWatched,subscribersGained,subscribersLost");
  u.searchParams.set("dimensions", "day");
  return yt<{ columnHeaders: { name: string }[]; rows?: (string | number)[][] }>(u.toString(), token);
}

export async function recentComments(token: string, channelId: string) {
  const r = await yt<{ items?: { id: string; snippet: { videoId?: string; topLevelComment: { id: string; snippet: { authorDisplayName: string; textOriginal: string; publishedAt: string } } } }[] }>(
    `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&allThreadsRelatedToChannelId=${encodeURIComponent(channelId)}&maxResults=50&order=time`,
    token,
  );
  return (r.items ?? []).map((t) => ({
    id: t.snippet.topLevelComment.id,
    author: t.snippet.topLevelComment.snippet.authorDisplayName,
    text: t.snippet.topLevelComment.snippet.textOriginal,
    time: t.snippet.topLevelComment.snippet.publishedAt,
    permalink: t.snippet.videoId ? `https://www.youtube.com/watch?v=${t.snippet.videoId}&lc=${t.snippet.topLevelComment.id}` : undefined,
  }));
}

export async function replyToComment(token: string, parentId: string, text: string) {
  return yt<{ id: string }>("https://www.googleapis.com/youtube/v3/comments?part=snippet", token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ snippet: { parentId, textOriginal: text } }),
  });
}

export async function videoStatistics(token: string, videoId: string) {
  const r = await yt<{ items?: { statistics: Record<string, string> }[] }>(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(videoId)}`, token);
  const s = r.items?.[0]?.statistics ?? {};
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v)]));
}
