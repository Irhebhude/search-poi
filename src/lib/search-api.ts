const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const CHAT_URL = `${BASE}/api/fn/search-ai`;
const WEB_SEARCH_URL = `${BASE}/api/fn/web-search`;
const SUMMARIZE_URL = `${BASE}/api/fn/summarize-url`;
const IMAGE_SEARCH_URL = `${BASE}/api/fn/image-search`;
const VIDEO_SEARCH_URL = `${BASE}/api/fn/video-search`;
const NEWS_SEARCH_URL = `${BASE}/api/fn/news-search`;
const POI_LIVE_URL = `${BASE}/api/fn/poi-live-search`;

export interface LivePOI {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string | null;
  website: string | null;
  lat: number;
  lon: number;
  mapUrl: string;
}

export interface LivePOIResponse {
  query: string;
  count: number;
  cached?: boolean;
  results: LivePOI[];
  message?: string;
}

export async function livePoiSearch(query: string, limit = 50): Promise<LivePOIResponse> {
  const resp = await fetch(POI_LIVE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    return { query, count: 0, results: [], message: data.error || "Live search failed. Try again." };
  }

  return resp.json();
}

export function poiToCsv(rows: LivePOI[]): string {
  const header = ["Name", "Category", "Address", "Phone", "Website", "Latitude", "Longitude", "Map"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.name, r.category, r.address, r.phone, r.website, r.lat, r.lon, r.mapUrl].map(esc).join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export type SearchMode = "default" | "deep_research" | "code" | "academic" | "business";

export interface WebResult {
  url: string;
  title: string;
  description: string;
  markdown?: string;
}

export async function webSearch(query: string, limit = 10): Promise<WebResult[]> {
  const resp = await fetch(WEB_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!resp.ok) {
    console.error("Web search failed:", resp.status);
    return [];
  }

  const data = await resp.json();
  return (data.data || []).map((r: any) => ({
    url: r.url || "",
    title: r.title || r.metadata?.title || "",
    description: r.description || r.metadata?.description || "",
    markdown: r.markdown || "",
  }));
}

export async function streamSearch({
  query,
  mode = "default",
  context = [],
  onDelta,
  onDone,
}: {
  query: string;
  mode?: SearchMode;
  context?: string[];
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, mode, context }),
  });

  if (resp.status === 429) throw new Error("Rate limit exceeded. Please try again in a moment.");
  if (resp.status === 402) throw new Error("Usage limit reached. Please add credits.");
  if (!resp.ok || !resp.body) throw new Error("Failed to start search");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

export async function summarizeUrl(url: string): Promise<string> {
  const resp = await fetch(SUMMARIZE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || "Failed to summarize URL");
  }

  const data = await resp.json();
  return data.summary;
}

export interface ImageResult {
  url: string;
  alt: string;
  sourceUrl: string;
  sourceTitle: string;
  domain: string;
  isThumbnail?: boolean;
}

export async function imageSearch(query: string, limit = 20): Promise<ImageResult[]> {
  const resp = await fetch(IMAGE_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!resp.ok) {
    console.error("Image search failed:", resp.status);
    return [];
  }

  const data = await resp.json();
  return data.images || [];
}

export interface VideoResult {
  url: string;
  title: string;
  description: string;
  thumbnail: string;
  platform: string;
  domain: string;
  videoId?: string;
}

export async function videoSearch(query: string, limit = 20): Promise<VideoResult[]> {
  const resp = await fetch(VIDEO_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!resp.ok) {
    console.error("Video search failed:", resp.status);
    return [];
  }

  const data = await resp.json();
  return data.videos || [];
}

export interface NewsResult {
  url: string;
  title: string;
  description: string;
  domain: string;
  publishedAt?: string | null;
  favicon?: string;
}

export async function newsSearch(query: string, limit = 20): Promise<NewsResult[]> {
  const resp = await fetch(NEWS_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!resp.ok) {
    console.error("News search failed:", resp.status);
    return [];
  }

  const data = await resp.json();
  return data.news || [];
}
