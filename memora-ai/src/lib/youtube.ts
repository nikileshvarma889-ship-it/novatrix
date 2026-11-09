import "server-only";

/** Thin wrapper around the official YouTube Data API v3 (server-side; the key never reaches the browser). */
const API = "https://www.googleapis.com/youtube/v3";

export class YtNotConfigured extends Error {
  constructor() { super("YouTube search isn't configured on the server (YOUTUBE_API_KEY is missing)."); }
}

export type YtVideo = { id: string; title: string; channel: string; channelId: string; thumbnail: string; publishedAt: string; description: string; duration?: number; embeddable?: boolean; views?: number };

async function yt<T>(path: string, params: Record<string, string>) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new YtNotConfigured();
  const url = new URL(`${API}/${path}`);
  Object.entries({ ...params, key }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const reason = j?.error?.errors?.[0]?.reason;
    const msg: string = j?.error?.message ?? "";
    if (/API key not valid|API_KEY_INVALID/i.test(msg)) throw new Error("The YouTube API key on the server isn't valid. Create a YouTube Data API v3 key in Google Cloud (it starts with “AIza”).");
    if (reason === "accessNotConfigured" || /has not been used|is disabled/i.test(msg)) throw new Error("YouTube Data API v3 isn't enabled for this API key's Google Cloud project.");
    throw new Error(reason === "quotaExceeded" ? "The daily YouTube search quota has been used up. Please try again tomorrow." : `YouTube API error (${res.status}).`);
  }
  return (await res.json()) as T;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const isoDur = (d?: string) => {
  const m = d?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (+(m[1] ?? 0)) * 86400 + (+(m[2] ?? 0)) * 3600 + (+(m[3] ?? 0)) * 60 + +(m[4] ?? 0) : undefined;
};

type SearchRes = { nextPageToken?: string; items: { id: { videoId: string } }[] };
type VideosRes = { items: { id: string; snippet: { title: string; channelTitle: string; channelId: string; publishedAt: string; description: string; thumbnails: Record<string, { url: string }> }; contentDetails?: { duration: string }; status?: { embeddable: boolean }; statistics?: { viewCount?: string } }[] };

export async function details(ids: string[]): Promise<YtVideo[]> {
  if (!ids.length) return [];
  const d = await yt<VideosRes>("videos", { part: "snippet,contentDetails,status,statistics", id: ids.join(","), maxResults: "50" });
  return d.items.map((v) => ({
    id: v.id, title: decode(v.snippet.title), channel: decode(v.snippet.channelTitle), channelId: v.snippet.channelId,
    thumbnail: v.snippet.thumbnails.high?.url ?? v.snippet.thumbnails.medium?.url ?? v.snippet.thumbnails.default?.url ?? "",
    publishedAt: v.snippet.publishedAt, description: v.snippet.description, duration: isoDur(v.contentDetails?.duration),
    embeddable: v.status?.embeddable, views: v.statistics?.viewCount ? +v.statistics.viewCount : undefined,
  }));
}

/** Search embeddable, safe-search, education-category videos. */
export async function search(q: string, pageToken?: string, max = 12) {
  const params: Record<string, string> = { part: "snippet", type: "video", q, maxResults: String(max), safeSearch: "strict", videoEmbeddable: "true", relevanceLanguage: "en", regionCode: "IN" };
  if (pageToken) params.pageToken = pageToken;
  const s = await yt<SearchRes>("search", params);
  const vids = await details(s.items.map((i) => i.id.videoId).filter(Boolean));
  return { videos: vids, nextPageToken: s.nextPageToken ?? null };
}
