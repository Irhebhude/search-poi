/**
 * Embeddings + vector search.
 *
 * Primary path: Cloudflare Workers AI (`@cf/baai/bge-base-en-v1.5`, 768 dims)
 * for embeddings and Cloudflare Vectorize for ANN search — both free-tier
 * bindings, no third-party API key.
 *
 * Fallback path (local dev / bindings absent): a deterministic hashing
 * embedder plus exact cosine similarity computed in the Worker over the
 * vectors stored in D1. Same interface, lower recall.
 */

import type { Env } from "./auth";

export const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
export const EMBED_DIMS = 768;

export interface VectorEnv extends Env {
  AI?: { run: (model: string, input: unknown) => Promise<any> };
  VECTORIZE?: {
    upsert: (v: Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }>) => Promise<unknown>;
    query: (
      values: number[],
      opts: { topK?: number; filter?: Record<string, unknown>; returnMetadata?: boolean | string },
    ) => Promise<{ matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> }>;
    deleteByIds: (ids: string[]) => Promise<unknown>;
  };
}

/* ------------------------------- embedding ------------------------------- */

/** Deterministic bag-of-hashed-tokens embedding used when Workers AI is absent. */
export function hashEmbed(text: string, dims = EMBED_DIMS): number[] {
  const v = new Float64Array(dims);
  const tokens = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    v[Math.abs(h) % dims] += 1;
    const bi = Math.abs(Math.imul(h, 31)) % dims;
    v[bi] += 0.5;
  }
  return normalize(Array.from(v));
}

export function normalize(v: number[]): number[] {
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

export async function embed(env: VectorEnv, texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  if (env.AI) {
    try {
      const out: number[][] = [];
      // Workers AI accepts batches; keep them small to stay inside limits.
      for (let i = 0; i < texts.length; i += 25) {
        const batch = texts.slice(i, i + 25);
        const res = await env.AI.run(EMBED_MODEL, { text: batch });
        const data: number[][] = res?.data ?? res?.embeddings ?? [];
        out.push(...data.map(normalize));
      }
      if (out.length === texts.length) return out;
    } catch {
      /* fall through to the local embedder */
    }
  }
  return texts.map((t) => hashEmbed(t));
}

/* --------------------------------- chunking ------------------------------- */

export interface Chunk {
  index: number;
  content: string;
  tokens: number;
}

/**
 * Sentence-aware chunker with overlap. `size` and `overlap` are in characters
 * (~4 chars per token), which keeps chunks comfortably inside the embedding
 * model's context window.
 */
export function chunkText(text: string, size = 1200, overlap = 180): Chunk[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?])\s+|\n{2,}/).filter(Boolean);
  const chunks: Chunk[] = [];
  let buf = "";

  const push = () => {
    const content = buf.trim();
    if (content) chunks.push({ index: chunks.length, content, tokens: Math.ceil(content.length / 4) });
  };

  for (const s of sentences) {
    if (buf.length + s.length + 1 > size && buf) {
      push();
      buf = overlap > 0 ? buf.slice(-overlap) + " " : "";
    }
    // A single oversized sentence is hard-split.
    if (s.length > size) {
      for (let i = 0; i < s.length; i += size) {
        buf += s.slice(i, i + size);
        push();
        buf = "";
      }
      continue;
    }
    buf += (buf ? " " : "") + s;
  }
  push();
  return chunks.map((c, i) => ({ ...c, index: i }));
}

/* ------------------------------ vector store ------------------------------ */

export async function upsertVectors(
  env: VectorEnv,
  rows: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>,
) {
  if (env.VECTORIZE && rows.length) {
    try {
      await env.VECTORIZE.upsert(rows);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export interface VectorMatch {
  chunk_id: string;
  score: number;
}

export async function queryVectors(
  env: VectorEnv,
  values: number[],
  opts: { topK: number; collectionId?: string; orgId?: string | null },
): Promise<VectorMatch[] | null> {
  if (!env.VECTORIZE) return null;
  try {
    const filter: Record<string, unknown> = {};
    if (opts.collectionId) filter.collection_id = opts.collectionId;
    if (opts.orgId) filter.org_id = opts.orgId;
    const res = await env.VECTORIZE.query(values, {
      topK: opts.topK,
      filter: Object.keys(filter).length ? filter : undefined,
      returnMetadata: true,
    });
    return (res.matches ?? []).map((m) => ({ chunk_id: m.id, score: m.score }));
  } catch {
    return null;
  }
}

/** Exact cosine search over D1-stored vectors (fallback + small collections). */
export async function bruteForceSearch(
  env: VectorEnv,
  queryVec: number[],
  opts: { topK: number; collectionId?: string; orgId?: string | null; limitScan?: number },
): Promise<VectorMatch[]> {
  const clauses: string[] = ["embedding IS NOT NULL"];
  const binds: unknown[] = [];
  if (opts.collectionId) {
    clauses.push("collection_id = ?");
    binds.push(opts.collectionId);
  }
  if (opts.orgId) {
    clauses.push("(org_id = ? OR org_id IS NULL)");
    binds.push(opts.orgId);
  }
  binds.push(opts.limitScan ?? 4000);
  const { results } = await env.DB.prepare(
    `SELECT id, embedding FROM document_chunks WHERE ${clauses.join(" AND ")} LIMIT ?`,
  ).bind(...binds).all<{ id: string; embedding: string }>();

  const scored: VectorMatch[] = [];
  for (const row of results ?? []) {
    try {
      scored.push({ chunk_id: row.id, score: cosine(queryVec, JSON.parse(row.embedding)) });
    } catch {
      /* skip malformed vectors */
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.topK);
}
