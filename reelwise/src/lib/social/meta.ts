// Meta Graph API: Facebook Pages + Instagram professional accounts.
// Docs: developers.facebook.com/docs/graph-api, /docs/instagram-platform
import fs from "node:fs";
import { PlatformError } from "./errors";

const V = () => process.env.META_GRAPH_VERSION || "v23.0";
const APP = () => {
  const id = process.env.META_APP_ID, secret = process.env.META_APP_SECRET;
  if (!id || !secret) throw new PlatformError("meta", "Meta is not configured. Set META_APP_ID and META_APP_SECRET (see docs/SETUP_META.md).");
  return { id, secret };
};
export const META_REDIRECT = () => `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/oauth/meta/callback`;

export const META_SCOPES = [
  "pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_read_user_content", "pages_manage_engagement",
  "read_insights", "business_management",
  "instagram_basic", "instagram_content_publish", "instagram_manage_comments", "instagram_manage_insights",
];

/** Turn Graph errors into messages that say what to fix. */
export function explainMetaError(e: { message?: string; code?: number; error_subcode?: number; type?: string }) {
  const c = e.code;
  if (c === 190) return { msg: "The Meta connection has expired or was revoked. Reconnect the account.", expired: true };
  if (c === 10 || c === 200 || (c && c >= 200 && c < 300))
    return { msg: `Meta denied permission: ${e.message}. The app needs this permission approved in App Review, and the account must grant it during login.`, expired: false };
  if (c === 4 || c === 17 || c === 32 || c === 613) return { msg: "Meta rate limit reached. The job will retry automatically.", expired: false };
  if (c === 9007 || c === 2207027) return { msg: "Instagram is still processing the video. The job will retry.", expired: false };
  return { msg: `Meta API error${c ? ` (${c})` : ""}: ${e.message ?? "unknown"}`, expired: false };
}

export async function graph<T = Record<string, unknown>>(path: string, opts: { method?: string; token?: string; params?: Record<string, string>; body?: BodyInit; host?: string } = {}): Promise<T> {
  const url = new URL(`https://${opts.host ?? "graph.facebook.com"}/${V()}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(opts.params ?? {})) url.searchParams.set(k, v);
  if (opts.token) url.searchParams.set("access_token", opts.token);
  const res = await fetch(url, { method: opts.method ?? "GET", body: opts.body });
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number } };
  if (!res.ok || data.error) {
    const { msg, expired } = explainMetaError(data.error ?? { message: `HTTP ${res.status}` });
    throw new PlatformError("meta", msg, data.error?.code, expired);
  }
  return data as T;
}

export function authUrl(state: string) {
  const u = new URL(`https://www.facebook.com/${V()}/dialog/oauth`);
  u.searchParams.set("client_id", APP().id);
  u.searchParams.set("redirect_uri", META_REDIRECT());
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", META_SCOPES.join(","));
  return u.toString();
}

/** code → long-lived user token (~60 days). Page tokens derived from it don't expire. */
export async function exchangeCode(code: string) {
  const { id, secret } = APP();
  const short = await graph<{ access_token: string }>("oauth/access_token", { params: { client_id: id, client_secret: secret, redirect_uri: META_REDIRECT(), code } });
  const long = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    params: { grant_type: "fb_exchange_token", client_id: id, client_secret: secret, fb_exchange_token: short.access_token },
  });
  const perms = await graph<{ data: { permission: string; status: string }[] }>("me/permissions", { token: long.access_token });
  return { userToken: long.access_token, expiresIn: long.expires_in, granted: perms.data.filter((p) => p.status === "granted").map((p) => p.permission) };
}

export type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
};

export async function listPages(userToken: string) {
  const res = await graph<{ data: MetaPage[] }>("me/accounts", {
    token: userToken,
    params: { fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}", limit: "100" },
  });
  return res.data;
}

// ---------- publishing ----------

/** Upload a video to a Facebook Page and wait until Meta reports it published. */
export async function publishFacebookVideo(pageId: string, pageToken: string, filePath: string, opts: { title: string; description: string }) {
  const form = new FormData();
  form.set("title", opts.title.slice(0, 250));
  form.set("description", opts.description);
  form.set("source", new Blob([fs.readFileSync(filePath)], { type: "video/mp4" }), "video.mp4");
  const res = await graph<{ id: string }>(`${pageId}/videos`, { method: "POST", token: pageToken, body: form, host: "graph-video.facebook.com" });
  // Confirm with the platform rather than assuming success.
  for (let i = 0; i < 60; i++) {
    const v = await graph<{ status?: { video_status?: string; publishing_phase?: { status?: string } }; permalink_url?: string }>(res.id, {
      token: pageToken,
      params: { fields: "status,permalink_url" },
    });
    const vs = v.status?.video_status;
    if (vs === "error") throw new PlatformError("facebook", "Facebook could not process this video.");
    if (vs === "ready" || v.status?.publishing_phase?.status === "complete")
      return { externalId: res.id, url: v.permalink_url ? `https://www.facebook.com${v.permalink_url}` : `https://www.facebook.com/${res.id}` };
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new PlatformError("facebook", "Facebook is still processing the video after 5 minutes. The job will check again.");
}

/** Publish an Instagram Reel via resumable upload → container → media_publish. */
export async function publishInstagramReel(igUserId: string, token: string, filePath: string, caption: string) {
  const container = await graph<{ id: string; uri: string }>(`${igUserId}/media`, {
    method: "POST",
    token,
    params: { media_type: "REELS", upload_type: "resumable", caption: caption.slice(0, 2200), share_to_feed: "true" },
  });
  const data = fs.readFileSync(filePath);
  const up = await fetch(container.uri, { method: "POST", headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(data.length) }, body: data });
  if (!up.ok) throw new PlatformError("instagram", `Instagram upload failed (HTTP ${up.status}): ${(await up.text()).slice(0, 300)}`);
  for (let i = 0; i < 60; i++) {
    const st = await graph<{ status_code?: string; status?: string }>(container.id, { token, params: { fields: "status_code,status" } });
    if (st.status_code === "FINISHED") break;
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new PlatformError("instagram", `Instagram rejected the video: ${st.status ?? st.status_code}`);
    if (i === 59) throw new PlatformError("instagram", "Instagram is still processing the video. The job will retry.");
    await new Promise((r) => setTimeout(r, 5000));
  }
  const pub = await graph<{ id: string }>(`${igUserId}/media_publish`, { method: "POST", token, params: { creation_id: container.id } });
  const media = await graph<{ permalink?: string }>(pub.id, { token, params: { fields: "permalink" } });
  return { externalId: pub.id, url: media.permalink ?? null };
}

// ---------- insights & comments ----------

export async function pageInsights(pageId: string, token: string, since: Date, until: Date) {
  const page = await graph<{ followers_count?: number; fan_count?: number }>(pageId, { token, params: { fields: "followers_count,fan_count" } });
  const ins = await graph<{ data: { name: string; values: { value: number; end_time: string }[] }[] }>(`${pageId}/insights`, {
    token,
    params: { metric: "page_impressions_unique,page_post_engagements,page_video_views", period: "day", since: String(Math.floor(+since / 1000)), until: String(Math.floor(+until / 1000)) },
  });
  return { followers: page.followers_count ?? page.fan_count ?? null, series: ins.data };
}

export async function instagramInsights(igId: string, token: string, since: Date, until: Date) {
  const acct = await graph<{ followers_count?: number; media_count?: number }>(igId, { token, params: { fields: "followers_count,media_count" } });
  const ins = await graph<{ data: { name: string; total_value?: { value: number } }[] }>(`${igId}/insights`, {
    token,
    params: { metric: "reach,views,likes,comments,shares,saves", period: "day", metric_type: "total_value", since: String(Math.floor(+since / 1000)), until: String(Math.floor(+until / 1000)) },
  });
  return { followers: acct.followers_count ?? null, totals: Object.fromEntries(ins.data.map((d) => [d.name, d.total_value?.value ?? null])) };
}

export async function instagramRecentComments(igId: string, token: string) {
  const media = await graph<{ data: { id: string; caption?: string; permalink?: string }[] }>(`${igId}/media`, { token, params: { fields: "id,caption,permalink", limit: "10" } });
  const out: { id: string; author: string; text: string; time: string; permalink?: string; context?: string }[] = [];
  for (const m of media.data) {
    const c = await graph<{ data: { id: string; username?: string; text: string; timestamp: string }[] }>(`${m.id}/comments`, { token, params: { fields: "id,username,text,timestamp", limit: "50" } });
    for (const x of c.data) out.push({ id: x.id, author: x.username ?? "", text: x.text, time: x.timestamp, permalink: m.permalink, context: m.caption?.slice(0, 80) });
  }
  return out;
}

export async function pageRecentComments(pageId: string, token: string) {
  const posts = await graph<{ data: { id: string; message?: string; permalink_url?: string }[] }>(`${pageId}/posts`, { token, params: { fields: "id,message,permalink_url", limit: "10" } });
  const out: { id: string; author: string; text: string; time: string; permalink?: string; context?: string }[] = [];
  for (const p of posts.data) {
    const c = await graph<{ data: { id: string; from?: { name?: string }; message: string; created_time: string }[] }>(`${p.id}/comments`, { token, params: { fields: "id,from,message,created_time", limit: "50" } });
    for (const x of c.data) out.push({ id: x.id, author: x.from?.name ?? "", text: x.message, time: x.created_time, permalink: p.permalink_url, context: p.message?.slice(0, 80) });
  }
  return out;
}

export async function replyToComment(platform: "facebook" | "instagram", commentId: string, token: string, message: string) {
  const edge = platform === "instagram" ? "replies" : "comments";
  return graph<{ id: string }>(`${commentId}/${edge}`, { method: "POST", token, params: { message } });
}

export async function instagramMediaMetrics(mediaId: string, token: string) {
  const r = await graph<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(`${mediaId}/insights`, {
    token,
    params: { metric: "views,reach,likes,comments,shares,saved" },
  });
  return Object.fromEntries(r.data.map((d) => [d.name, d.total_value?.value ?? d.values?.[0]?.value ?? null]));
}

export async function facebookVideoMetrics(videoId: string, token: string) {
  const r = await graph<{ data: { name: string; values: { value: number }[] }[] }>(`${videoId}/video_insights`, {
    token,
    params: { metric: "total_video_views,total_video_reactions_by_type_total,total_video_avg_time_watched" },
  });
  return Object.fromEntries(r.data.map((d) => [d.name, d.values?.[0]?.value ?? null]));
}
