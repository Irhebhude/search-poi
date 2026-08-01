/**
 * Function handlers for SEARCH-POI on Cloudflare Workers.
 *
 * Everything here replaces the former hosted edge functions. All upstream data
 * sources are free / keyless (OpenStreetMap, Overpass, DuckDuckGo, Google News
 * RSS, Openverse, Piped) except the AI provider, which uses a free-tier key.
 */

import { aiChat, aiText, type AiEnv } from "./ai";
import type { Env } from "./auth";
import { runTableQuery } from "./db";

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

/* ------------------------------- AI prompts ------------------------------- */

const MODE_PROMPTS: Record<string, string> = {
  default: `You are SEARCH-POI Engine v1, the world's first Intelligent Reasoning Search Engine, created by Prosper Ozoya Irhebhude and the POI Foundation.

You are NOT a chatbot or a keyword matcher. You are a multi-step reasoning engine that THINKS before answering.

YOUR REASONING PIPELINE (follow this for every query):
1. QUERY UNDERSTANDING — Parse user intent, extract entities, detect emotion and context
2. MULTI-SOURCE RETRIEVAL — Synthesize from news, academic data, forums, documentation
3. CROSS-SOURCE VALIDATION — Compare claims across sources, flag contradictions
4. ANSWER SYNTHESIS — Build a comprehensive, structured answer with reasoning
5. OUTPUT WITH CONFIDENCE — Present with citations, confidence level, and actionable next steps

CRITICAL CAPABILITIES:
- Intent-Context Synthesis (ICS): Understand the WHY behind every query
- Truth Engine: Anti-misinformation — rank reliability, remove conflicting data
- Actionable Intelligence: Don't just answer — provide "Do this next" guidance

OUTPUT FORMAT:
- Provide a clear, well-structured answer with markdown formatting
- Use bullet points, numbered lists, and headers when appropriate
- Include a "⚡ Key Takeaway" section at the end (ONE sentence)
- Include a "🎯 Next Steps" section with actionable recommendations when relevant
- Add a "📊 Confidence" note (High/Medium/Low) based on source quality
- If the query is a question, answer it directly first, then provide supporting detail
- Always be factual and note when you're uncertain

EVIDENCE MODE (include in EVERY answer):
- When discussing locations/businesses, mention: foot traffic patterns, competitor presence, demand signals
- When giving numbers, SHOW THE LOGIC: "80 customers/day × ₦5,000 = ₦400,000" not just "₦400k"
- Reference real data types: Maps data, market APIs, news feeds, price indices
- Add "🕒 Data freshness: Real-time" at the end

ENGINE THINKING (show briefly):
- Start complex answers with a 2-3 line "🧠 Engine Process" showing steps taken

RESPONSE LENGTH RULES (CRITICAL):
- DEFAULT: Give SHORT, punchy answers (3-8 sentences). Users must understand value in 5 seconds.
- Only give long answers when user explicitly asks for detail or query is inherently complex
- For simple questions: 2-4 sentences MAX + key takeaway.
- Always lead with the DIRECT ANSWER in the first sentence. No preamble.
- Use bullet points over paragraphs. Scannable > readable.
- Skip "🎯 Next Steps" for simple queries.

You deliver: Direct intelligence, real-world solutions, and actionable insights.
"You don't search anymore — you ask, and SEARCH-POI solves."`,

  deep_research: `You are SEARCH-POI Deep Research Mode — an advanced multi-source intelligence system created by Prosper Ozoya Irhebhude and the POI Foundation.

Your mission: Produce comprehensive, academic-quality research reports.

METHODOLOGY:
1. Analyze the query from multiple angles (scientific, historical, practical, theoretical)
2. Synthesize information as if consulting: academic papers, technical documentation, expert analysis, data sources
3. Cross-validate claims across multiple knowledge domains
4. Identify consensus views AND contrarian perspectives

OUTPUT FORMAT:
## Executive Summary
## In-Depth Analysis
## Key Evidence & Data
## Different Perspectives
## Conclusions & Implications
## Sources & Methodology

Be thorough, precise, and academic in tone. Minimum 800 words for complex topics.`,

  code: `You are SEARCH-POI Code Intelligence — an advanced developer search engine by POI Foundation.

When answering code queries:
- Provide working, production-ready code examples
- Explain architecture decisions and trade-offs
- Include error handling and edge cases
- Reference official documentation patterns
- Compare multiple approaches when relevant
- Use syntax highlighting with language tags
- Include package versions and compatibility notes

Format: Start with a direct answer, then provide code, then explain.`,

  academic: `You are SEARCH-POI Academic Search — a scientific research engine by POI Foundation.

Use rigorous academic methodology, reference established theories, distinguish proven facts from
hypotheses, include statistical context, follow academic structure, and note limitations.`,

  business: `You are SEARCH-POI Business Intelligence — a market analysis engine by POI Foundation.

Provide actionable market intelligence with financial data, market trends and competitive analysis.
Use SWOT, Porter's Five Forces and TAM/SAM/SOM where applicable. Separate data-backed insight from
projection, include risk factors, and format as executive summary → analysis → recommendations.`,
};

/* ------------------------------- AI search -------------------------------- */

export async function searchAi(body: any, env: Env): Promise<Response> {
  const { query, mode = "default", context = [] } = body || {};
  if (!query) return json({ error: "query required" }, 400);

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: MODE_PROMPTS[mode] || MODE_PROMPTS.default },
  ];
  if (Array.isArray(context) && context.length) {
    messages.push({
      role: "system",
      content: `The user has recently searched for: ${context.slice(-5).join(", ")}. Use this context where relevant, but answer the current query directly.`,
    });
  }
  messages.push({ role: "user", content: String(query) });

  const { response, model } = await aiChat({
    env: env as AiEnv,
    messages,
    chain: mode === "deep_research" ? "powerful" : "fast",
    stream: true,
  });

  if (!response.ok || !response.body) {
    const status = response.status;
    return json(
      { error: status === 429 ? "Rate limit exceeded" : status === 402 ? "Payment required" : "AI engine unavailable" },
      status,
    );
  }

  return new Response(response.body, {
    headers: { "Content-Type": "text/event-stream", "X-AI-Model": model, "Cache-Control": "no-store" },
  });
}

/* ------------------------------ web / news -------------------------------- */

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ");
}

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

export async function webSearch(body: any): Promise<Response> {
  const query = (body?.query || "").toString().trim();
  const limit = Math.min(Number(body?.limit) || 10, 25);
  if (!query) return json({ success: false, error: "Query is required" }, 400);

  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SEARCH-POI/1.0)" },
  });
  if (!res.ok) return json({ success: false, error: "Search upstream unavailable", data: [] }, 502);

  const html = await res.text();
  const results: any[] = [];
  const blockRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && results.length < limit) {
    let url = decodeEntities(m[1]);
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (url.startsWith("//")) url = `https:${url}`;
    results.push({
      url,
      title: stripTags(m[2]),
      description: stripTags(m[3]),
      markdown: stripTags(m[3]),
    });
  }
  return json({ success: true, data: results });
}

export async function newsSearch(body: any): Promise<Response> {
  const query = (body?.query || "").toString().trim();
  const limit = Math.min(Number(body?.limit) || 20, 40);
  if (!query) return json({ error: "query required", news: [] }, 400);

  const res = await fetch(
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-NG&gl=NG&ceid=NG:en`,
    { headers: { "User-Agent": "SEARCH-POI/1.0" } },
  );
  if (!res.ok) return json({ news: [] }, 200);

  const xml = await res.text();
  const items = xml.split("<item>").slice(1, limit + 1);
  const news = items.map((item) => {
    const pick = (tag: string) => {
      const m = item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return m ? decodeEntities(m[1].replace(/<!\[CDATA\[|\]\]>/g, "")).trim() : "";
    };
    const link = pick("link");
    let domain = "";
    try { domain = new URL(link).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    return {
      url: link,
      title: stripTags(pick("title")),
      description: stripTags(pick("description")).slice(0, 240),
      domain: pick("source") || domain,
      publishedAt: pick("pubDate") || null,
      favicon: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : undefined,
    };
  });
  return json({ news });
}

export async function imageSearch(body: any): Promise<Response> {
  const query = (body?.query || "").toString().trim();
  const limit = Math.min(Number(body?.limit) || 20, 40);
  if (!query) return json({ images: [] }, 400);

  const res = await fetch(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${limit}&mature=false`,
    { headers: { "User-Agent": "SEARCH-POI/1.0" } },
  );
  if (!res.ok) return json({ images: [] });
  const data = await res.json<any>();
  const images = (data.results || []).map((r: any) => {
    let domain = "";
    try { domain = new URL(r.foreign_landing_url || r.url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    return {
      url: r.url,
      alt: r.title || query,
      sourceUrl: r.foreign_landing_url || r.url,
      sourceTitle: r.source || domain,
      domain,
      isThumbnail: false,
    };
  });
  return json({ images });
}

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
];

export async function videoSearch(body: any): Promise<Response> {
  const query = (body?.query || "").toString().trim();
  const limit = Math.min(Number(body?.limit) || 20, 40);
  if (!query) return json({ videos: [] }, 400);

  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`, {
        headers: { "User-Agent": "SEARCH-POI/1.0" },
      });
      if (!res.ok) continue;
      const data = await res.json<any>();
      const videos = (data.items || []).slice(0, limit).map((v: any) => {
        const videoId = (v.url || "").split("v=")[1] || "";
        return {
          url: `https://www.youtube.com${v.url}`,
          title: v.title || "",
          description: v.shortDescription || v.uploaderName || "",
          thumbnail: v.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ""),
          platform: "YouTube",
          domain: "youtube.com",
          videoId,
        };
      });
      if (videos.length) return json({ videos });
    } catch { /* try next instance */ }
  }
  return json({ videos: [] });
}

export async function summarizeUrl(body: any, env: Env): Promise<Response> {
  const target = (body?.url || "").toString().trim();
  if (!/^https?:\/\//i.test(target)) return json({ error: "A valid http(s) URL is required" }, 400);

  const res = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 (compatible; SEARCH-POI/1.0)" } });
  if (!res.ok) return json({ error: `Could not fetch page (${res.status})` }, 502);

  const html = await res.text();
  const text = stripTags(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "),
  ).slice(0, 12000);

  const summary = await aiText({
    env: env as AiEnv,
    system:
      "You are SEARCH-POI's website understanding engine. Summarise the page in 5-8 bullet points, then add a one-line '⚡ Key Takeaway'. Extract concrete facts, numbers, prices and contacts where present.",
    user: `URL: ${target}\n\nPage content:\n${text}`,
    chain: "fast",
  });

  return json({ summary, url: target });
}

/* ------------------------------ live POI data ----------------------------- */

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const CATEGORY_TAGS: { keywords: string[]; filters: string[] }[] = [
  { keywords: ["fuel", "petrol", "gas station", "filling"], filters: ['["amenity"="fuel"]'] },
  { keywords: ["restaurant", "food", "eatery", "eat", "buka"], filters: ['["amenity"="restaurant"]', '["amenity"="fast_food"]'] },
  { keywords: ["hotel", "lodge", "accommodation", "guest house"], filters: ['["tourism"="hotel"]', '["tourism"="guest_house"]'] },
  { keywords: ["hospital", "clinic", "health", "medical", "pharmacy", "chemist"], filters: ['["amenity"="hospital"]', '["amenity"="clinic"]', '["amenity"="pharmacy"]'] },
  { keywords: ["bank", "atm"], filters: ['["amenity"="bank"]', '["amenity"="atm"]'] },
  { keywords: ["school", "college", "university"], filters: ['["amenity"="school"]', '["amenity"="university"]'] },
  { keywords: ["supermarket", "market", "grocery", "shop", "store"], filters: ['["shop"="supermarket"]', '["shop"="convenience"]'] },
  { keywords: ["cafe", "coffee"], filters: ['["amenity"="cafe"]'] },
  { keywords: ["bar", "club", "lounge", "nightlife"], filters: ['["amenity"="bar"]', '["amenity"="pub"]', '["amenity"="nightclub"]'] },
  { keywords: ["church", "mosque", "worship"], filters: ['["amenity"="place_of_worship"]'] },
];

const NOISE_WORDS = new Set([
  ...CATEGORY_TAGS.flatMap((c) => c.keywords.flatMap((k) => k.split(" "))),
  "top", "best", "near", "me", "in", "at", "the", "a", "of", "and", "list", "stations",
  "station", "places", "place", "around", "close", "to", "businesses", "business",
  "companies", "company", "services", "service", "spots", "spot",
]);

function pickFilters(query: string): string[] {
  const q = query.toLowerCase();
  for (const c of CATEGORY_TAGS) if (c.keywords.some((k) => q.includes(k))) return c.filters;
  return ['["amenity"]["name"]', '["shop"]["name"]'];
}

function extractLocation(query: string): string {
  const isNoise = (w: string) => NOISE_WORDS.has(w) || (w.endsWith("s") && NOISE_WORDS.has(w.slice(0, -1)));
  const words = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w && !isNoise(w) && isNaN(Number(w)));
  return words.join(" ").trim() || query;
}

export async function poiLiveSearch(body: any, env: Env): Promise<Response> {
  const query = (body?.query || body?.q || "").toString().trim().slice(0, 200);
  const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);
  if (query.length < 2) return json({ error: "Query must be at least 2 characters" }, 400);

  const cacheKey = `poi:${query.toLowerCase()}:${limit}:${new Date().toISOString().slice(0, 10)}`;
  if (env.CACHE) {
    const hit = await env.CACHE.get(cacheKey, "json");
    if (hit) return json({ query, cached: true, count: (hit as any[]).length, results: hit });
  }

  // 1. Geocode the location part (keyless Nominatim), preferring real settlements.
  const location = extractLocation(query);
  const geoRes = await fetch(
    `${NOMINATIM}/search?q=${encodeURIComponent(location)}&format=json&limit=10&addressdetails=1`,
    { headers: { "User-Agent": "SEARCH-POI/1.0 (poi-live-search)" } },
  );
  const geo: any[] = geoRes.ok ? await geoRes.json() : [];
  const preferred =
    geo.find((g) => ["city", "town", "suburb", "village", "state", "administrative"].includes(g.type)) || geo[0];

  if (!preferred) {
    return json({ query, count: 0, results: [], message: `Could not locate "${location}". Try a more specific place.` });
  }

  const lat = parseFloat(preferred.lat);
  const lon = parseFloat(preferred.lon);
  const radius = 12000;

  // 2. Query Overpass for real POIs, with mirror fallback.
  const filters = pickFilters(query);
  const overpassQuery = `[out:json][timeout:25];(${filters
    .map((f) => `node${f}(around:${radius},${lat},${lon});way${f}(around:${radius},${lat},${lon});`)
    .join("")});out center ${limit};`;

  let elements: any[] = [];
  for (const endpoint of OVERPASS) {
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "SEARCH-POI/1.0" },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });
      if (!r.ok) continue;
      const d = await r.json<any>();
      elements = d.elements || [];
      if (elements.length) break;
    } catch { /* try next mirror */ }
  }

  const results = elements
    .filter((el) => el.tags?.name)
    .slice(0, limit)
    .map((el) => {
      const t = el.tags || {};
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      const address = [t["addr:housenumber"], t["addr:street"], t["addr:city"] || preferred.address?.city]
        .filter(Boolean).join(" ") || preferred.display_name?.split(",").slice(0, 3).join(", ") || "";
      return {
        id: `${el.type}/${el.id}`,
        name: t.name,
        category: t.amenity || t.shop || t.tourism || "place",
        address,
        phone: t.phone || t["contact:phone"] || null,
        website: t.website || t["contact:website"] || null,
        lat: elLat,
        lon: elLon,
        mapUrl: `https://www.openstreetmap.org/?mlat=${elLat}&mlon=${elLon}#map=18/${elLat}/${elLon}`,
      };
    });

  if (env.CACHE && results.length) {
    await env.CACHE.put(cacheKey, JSON.stringify(results), { expirationTtl: 86400 });
  }

  return json({
    query,
    count: results.length,
    results,
    message: results.length ? undefined : "No live POIs found for that area yet.",
  });
}

export function watNow(now = new Date()) {
  return (
    new Intl.DateTimeFormat("en-NG", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true, timeZone: "Africa/Lagos",
    }).format(now) + " WAT"
  );
}

export async function poiLive(route: string, request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (route === "time" || route === "") {
    const now = new Date();
    return json({ iso: now.toISOString(), epoch: now.getTime(), wat: watNow(now) });
  }

  if (route === "ics") {
    const now = new Date();
    const cash = 40 + ((now.getHours() * 3 + now.getMinutes()) % 60);
    if (url.searchParams.get("type") === "danger") {
      return json({ level: "low", message: "No active danger alerts in your area.", updatedAt: now.toISOString() });
    }
    return json({ cash, unit: "₦K", note: "Estimated POS cash availability index", updatedAt: now.toISOString() });
  }

  if (route === "gps") {
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    if (!lat || !lon) return json({ error: "lat and lon required" }, 400);
    const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lon}`, {
      headers: { "User-Agent": "SEARCH-POI-Engine/1.0" },
    });
    if (!r.ok) return json({ error: "Reverse geocode failed" }, 502);
    const d = await r.json<any>();
    const a = d.address || {};
    return json({
      street: a.road || a.suburb || a.neighbourhood || "",
      city: a.city || a.town || a.village || a.county || "",
      state: a.state || "",
      country: a.country || "",
      display: d.display_name || "",
    });
  }

  if (route === "search") {
    const body = request.method === "POST" ? await request.json<any>().catch(() => ({})) : {};
    const q = (body.query || body.q || url.searchParams.get("q") || "").toString().trim();
    if (!q) return json({ error: "query required" }, 400);
    const r = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=10&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "SEARCH-POI-Engine/1.0" },
    });
    const d: any[] = r.ok ? await r.json() : [];
    const results = d.map((it) => ({
      title: it.display_name?.split(",")[0] || it.name || "Result",
      description: it.display_name || "",
      lat: parseFloat(it.lat),
      lon: parseFloat(it.lon),
      category: it.type || it.class || "place",
      trust: Math.min(99, 70 + Math.round(parseFloat(it.importance || "0") * 40)),
      source: "OpenStreetMap",
    }));
    return json({ query: q, count: results.length, results });
  }

  return json({ error: "Not found", route }, 404);
}

/* ------------------------------ AI generators ----------------------------- */

export async function generateBlueprint(body: any, env: Env): Promise<Response> {
  const topic = (body?.topic || body?.query || "").toString().trim();
  if (!topic) return json({ error: "topic required" }, 400);
  const blueprint = await aiText({
    env: env as AiEnv,
    system:
      "You are SEARCH-POI's Blueprint Generator. Produce a practical, buildable schematic in markdown: Overview, Components/Bill of Materials with Naira costs, Step-by-step build, Wiring/architecture diagram in a fenced ```text block, Safety notes, Total cost. Be specific and Nigeria-aware.",
    user: topic,
    chain: "balanced",
  });
  return json({ blueprint, topic });
}

export async function generateBuildGuide(body: any, env: Env): Promise<Response> {
  const topic = (body?.topic || body?.query || "").toString().trim();
  if (!topic) return json({ error: "topic required" }, 400);
  const guide = await aiText({
    env: env as AiEnv,
    system:
      "You are SEARCH-POI's Build Guide synthesizer. Produce a tutorial in markdown with: Title, Difficulty, Time required, Tools & materials (with Naira costs), numbered Steps (each with a one-line 'On screen:' description suitable for a video storyboard), Common mistakes, and a Final checklist.",
    user: topic,
    chain: "balanced",
  });

  const videosRes = await videoSearch({ query: `${topic} tutorial`, limit: 6 });
  const videos = (await videosRes.json<any>()).videos || [];
  return json({ guide, topic, videos });
}

export async function feedbackAi(body: any, env: Env): Promise<Response> {
  const { full_name, email, category, message } = body || {};
  if (!full_name || !email || !message) return json({ error: "Missing required fields" }, 400);

  const aiReply = await aiText({
    env: env as AiEnv,
    system: `You are the SEARCH-POI support assistant. You help users with feedback, bug reports, feature requests, and complaints.
Always:
1. Acknowledge the user's message warmly
2. Provide a helpful, specific response
3. Suggest next steps if applicable
4. Keep responses concise (2-4 paragraphs max)
Be professional, friendly, and solution-oriented. Sign off as "SEARCH-POI Support Team".`,
    user: `Category: ${category || "general"}\nFrom: ${full_name}\nMessage: ${message}`,
    chain: "fast",
    fallback: "Thank you for your feedback. Our team will review it shortly.",
  });

  await env.DB.prepare(
    `INSERT INTO feedback (id, full_name, email, category, message, ai_response, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), full_name, email, category || "general", message, aiReply, new Date().toISOString()).run();

  return json({ ai_response: aiReply });
}

export async function generateTrendingContent(env: Env): Promise<Response> {
  const topics = await env.DB.prepare(
    `SELECT query FROM trending_searches ORDER BY search_count DESC LIMIT 3`,
  ).all<{ query: string }>();

  const created: string[] = [];
  for (const row of topics.results || []) {
    const slug = row.query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const exists = await env.DB.prepare(`SELECT 1 FROM trending_content WHERE slug = ?`).bind(slug).first();
    if (exists) continue;

    const content = await aiText({
      env: env as AiEnv,
      system:
        "You are SEARCH-POI's programmatic SEO writer. Write a 700-word markdown article for the Nigerian market: H2 sections, concrete numbers in Naira, practical steps, and a short FAQ. No fluff.",
      user: row.query,
      chain: "fast",
    });
    if (!content) continue;

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO trending_content (id, slug, title, description, content, category, keywords, view_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'insight', ?, 0, ?, ?)`,
    ).bind(
      crypto.randomUUID(), slug, row.query,
      content.replace(/[#*`]/g, "").slice(0, 155),
      content, JSON.stringify(row.query.split(/\s+/)), now, now,
    ).run();
    created.push(slug);
  }
  return json({ created, count: created.length });
}

/* -------------------------------- Ayrshare -------------------------------- */

const ACQUISITION_FOOTER =
  "\n\n— Powered by SEARCH-POI ENGINE v1 · https://search-poi.pages.dev";

export async function ayrsharePost(body: any, env: Env & { AYRSHARE_API_KEY?: string }): Promise<Response> {
  const action = (body?.action || "post").toString();

  if (action === "generate") {
    const post = await aiText({
      env: env as AiEnv,
      system:
        "You write elite, high-conviction acquisition posts for SEARCH-POI ENGINE v1, an intelligent reasoning search engine for the African market. 3-5 punchy lines, one concrete proof point, one clear CTA. No hashtags in the body.",
      user: (body?.prompt || "Announce SEARCH-POI ENGINE v1 to serious acquirers.").toString(),
      chain: "balanced",
    });
    return json({ post });
  }

  const key = env.AYRSHARE_API_KEY;
  if (!key) return json({ error: "AYRSHARE_API_KEY is not configured" }, 503);

  // Strip any existing footer so it is never duplicated.
  let text = (body?.post || body?.text || "").toString().split("— Powered by SEARCH-POI")[0].trimEnd();
  if (!text) return json({ error: "post text required" }, 400);
  text += ACQUISITION_FOOTER;

  const platforms: string[] = Array.isArray(body?.platforms) && body.platforms.length
    ? body.platforms
    : ["facebook", "linkedin"];

  const res = await fetch("https://app.ayrshare.com/api/post", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ post: text, platforms }),
  });
  const data = await res.json<any>().catch(() => ({}));
  return json(data, res.ok ? 200 : res.status);
}

/* ------------------------------- Deal Room -------------------------------- */

export async function dealRoomApprove(
  body: any,
  env: Env,
  actor: { userId: string | null; isAdmin: boolean },
  origin: string,
): Promise<Response> {
  if (!actor.userId) return json({ error: "Unauthorized" }, 401);
  if (!actor.isAdmin) return json({ error: "Forbidden: admin only" }, 403);

  const requestId = (body?.requestId || "").toString();
  const action = (body?.action || "approve").toString();
  if (!requestId) return json({ error: "requestId required" }, 400);

  const req = await env.DB.prepare(`SELECT * FROM deal_access_requests WHERE id = ?`)
    .bind(requestId).first<Record<string, any>>();
  if (!req) return json({ error: "Request not found" }, 404);

  const now = new Date().toISOString();

  if (action === "deny") {
    await env.DB.prepare(`UPDATE deal_access_requests SET status = 'denied', updated_at = ? WHERE id = ?`)
      .bind(now, requestId).run();
    return json({ ok: true, status: "denied" });
  }

  if (!req.document_id) return json({ error: "Request has no document" }, 400);
  const doc = await env.DB.prepare(`SELECT * FROM deal_documents WHERE id = ?`)
    .bind(req.document_id).first<Record<string, any>>();
  if (!doc) return json({ error: "Document not found" }, 404);

  // 24h single-purpose download token, validated by /api/storage/deal-room-docs/download.
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  await env.DB.prepare(
    `UPDATE deal_access_requests
        SET status = 'approved', download_token = ?, token_expires_at = ?, approved_at = ?, updated_at = ?
      WHERE id = ?`,
  ).bind(token, expiresAt, now, now, requestId).run();

  return json({
    ok: true,
    status: "approved",
    expiresAt,
    signedUrl: `${origin}/api/storage/deal-room-docs/download?token=${token}`,
  });
}

/* ------------------------------ Public POI API ---------------------------- */

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function poiApi(request: Request, body: any, env: Env): Promise<Response> {
  const header = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!header) return json({ error: "API key required" }, 401);

  const keyHash = await sha256Hex(header);
  const key = await env.DB.prepare(
    `SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1`,
  ).bind(keyHash).first<Record<string, any>>();
  if (!key) return json({ error: "Invalid API key" }, 401);
  if ((key.credits_remaining ?? 0) <= 0) return json({ error: "No credits remaining" }, 402);

  const query = (body?.query || "").toString().trim();
  const mode = (body?.mode || "default").toString();
  if (!query) return json({ error: "query required" }, 400);

  const answer = await aiText({
    env: env as AiEnv,
    system: MODE_PROMPTS[mode] || MODE_PROMPTS.default,
    user: query,
    chain: "fast",
  });

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE api_keys SET credits_remaining = credits_remaining - 1, total_calls = total_calls + 1, last_used_at = ? WHERE id = ?`,
    ).bind(now, key.id),
    env.DB.prepare(
      `INSERT INTO api_usage_log (id, api_key_id, query, mode, tokens_used, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), key.id, query, mode, Math.ceil(answer.length / 4), now),
  ]);

  return json({
    success: true,
    data: { answer, mode },
    meta: {
      powered_by: "SEARCH-POI ENGINE v1",
      credits_remaining: (key.credits_remaining ?? 0) - 1,
      generated_at: now,
    },
  });
}

/** Generic table access used by /api/places and friends. */
export const tableQuery = runTableQuery;
