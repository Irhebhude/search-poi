/**
 * D1 + Workers AI semantic search (Vectorize-free).
 *
 * Embeddings are produced with `@cf/baai/bge-base-en-v1.5` (768 dims) and
 * stored as a JSON array in `pois.embedding`. Similarity is exact cosine
 * computed in the Worker. Results are cached in KV (`CACHE`) for one hour.
 */

import type { Env } from "./auth";

export const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
export const EMBED_DIMS = 768;
const CACHE_TTL = 3600;

export interface SemanticEnv extends Env {
  AI?: { run: (model: string, input: unknown) => Promise<any> };
}

export interface PoiRow {
  id: string | number;
  name?: string;
  category?: string;
  address?: string;
  lat?: number;
  lon?: number;
  [key: string]: unknown;
}

export interface SemanticHit extends PoiRow {
  score: number;
}

function normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}

/** Deterministic fallback embedder used when the AI binding is absent. */
export function hashEmbed(text: string, dims = EMBED_DIMS): number[] {
  const v = new Array(dims).fill(0);
  for (const t of text.toLowerCase().match(/[a-z0-9']+/g) ?? []) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    v[Math.abs(h) % dims] += 1;
    v[Math.abs(Math.imul(h, 31)) % dims] += 0.5;
  }
  return normalize(v);
}

/** Embed one or more strings with Workers AI, falling back to hashEmbed. */
export async function embedTexts(env: SemanticEnv, texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  if (env.AI) {
    try {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += 25) {
        const res = await env.AI.run(EMBED_MODEL, { text: texts.slice(i, i + 25) });
        const data: number[][] = res?.data ?? res?.embeddings ?? [];
        out.push(...data.map(normalize));
      }
      if (out.length === texts.length) return out;
    } catch {
      /* fall through */
    }
  }
  return texts.map((t) => hashEmbed(t));
}

/**
 * Semantic search over `pois`. Returns the top `topK` (default 20) rows by
 * cosine similarity, cached in KV for one hour.
 */
export async function semanticSearch(
  query: string,
  env: SemanticEnv,
  topK = 20,
): Promise<{ query: string; cached: boolean; count: number; results: SemanticHit[] }> {
  const q = query.trim();
  if (!q) return { query, cached: false, count: 0, results: [] };

  const cacheKey = `sem:${topK}:${q.toLowerCase()}`;
  if (env.CACHE) {
    const hit = await env.CACHE.get(cacheKey, "json").catch(() => null);
    if (hit) return { ...(hit as any), cached: true };
  }

  const [vec] = await embedTexts(env, [q]);

  let rows: Array<PoiRow & { embedding: string }> = [];
  try {
    const res = await env.DB.prepare(
      `SELECT * FROM pois WHERE embedding IS NOT NULL LIMIT 5000`,
    ).all<PoiRow & { embedding: string }>();
    rows = res.results ?? [];
  } catch {
    // pois table may not exist yet on a fresh database
    return { query: q, cached: false, count: 0, results: [] };
  }

  const scored: SemanticHit[] = [];
  for (const row of rows) {
    try {
      const { embedding, ...rest } = row;
      scored.push({ ...rest, score: cosine(vec, JSON.parse(embedding)) });
    } catch {
      /* skip malformed vectors */
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const payload = { query: q, cached: false, count: Math.min(topK, scored.length), results: scored.slice(0, topK) };
  if (env.CACHE) {
    await env.CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: CACHE_TTL }).catch(() => {});
  }
  return payload;
}

/** Compute and persist the embedding for a single POI row. */
export async function indexPoi(env: SemanticEnv, poi: PoiRow): Promise<void> {
  const text = [poi.name, poi.category, poi.address].filter(Boolean).join(" · ");
  if (!text) return;
  const [vec] = await embedTexts(env, [text]);
  await env.DB.prepare(`UPDATE pois SET embedding = ? WHERE id = ?`)
    .bind(JSON.stringify(vec), poi.id)
    .run();
}

/** Backfill embeddings for POIs that don't have one yet. */
export async function reindexPois(env: SemanticEnv, limit = 200): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT id, name, category, address FROM pois WHERE embedding IS NULL LIMIT ?`,
  ).bind(limit).all<PoiRow>();
  const rows = results ?? [];
  if (!rows.length) return 0;
  const vecs = await embedTexts(
    env,
    rows.map((r) => [r.name, r.category, r.address].filter(Boolean).join(" · ")),
  );
  const stmt = env.DB.prepare(`UPDATE pois SET embedding = ? WHERE id = ?`);
  await env.DB.batch(rows.map((r, i) => stmt.bind(JSON.stringify(vecs[i]), r.id)));
  return rows.length;
}
