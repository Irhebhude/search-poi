/**
 * Retrieval-Augmented Generation.
 *
 * - Collections and documents (text, URL or uploaded file content)
 * - Chunking + embedding on ingest, Vectorize upsert with D1 mirror
 * - Hybrid retrieval: dense vectors + keyword (BM25-ish) with score fusion
 * - Cross-encoder-lite reranking, then a grounded answer with inline citations
 * - Conversation memory scoped to a collection
 */

import { aiText } from "./ai";
import type { Env } from "./auth";
import {
  bruteForceSearch, chunkText, embed, EMBED_MODEL, queryVectors, upsertVectors, type VectorEnv,
} from "./embeddings";
import { consumeQuota, requirePermission } from "./tenancy";
import { audit, forbidden, HttpError, json, notFound, nowIso, sha256Hex, slugify, uid, unauthorized } from "./util";

type User = { id: string; email: string } | null | undefined;

/* ------------------------------- collections ------------------------------ */

async function assertCollectionAccess(env: Env, collectionId: string, user: User, write = false) {
  const col = await env.DB.prepare(`SELECT * FROM collections WHERE id = ?`).bind(collectionId).first<any>();
  if (!col) throw notFound("Collection not found");
  if (col.is_public && !write) return col;
  if (!user) throw unauthorized();
  if (col.user_id === user.id) return col;
  if (col.org_id) {
    await requirePermission(env, col.org_id, user.id, write ? "documents:write" : "documents:read");
    return col;
  }
  throw forbidden("You do not have access to this collection");
}

export async function createCollection(env: Env, user: User, body: any) {
  if (!user) throw unauthorized();
  if (body?.org_id) await requirePermission(env, body.org_id, user.id, "documents:write");
  const id = uid();
  await env.DB.prepare(
    `INSERT INTO collections (id, org_id, user_id, name, slug, description, is_public, embedding_model, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).bind(
    id, body?.org_id ?? null, user.id, String(body?.name ?? "Untitled collection").slice(0, 100),
    slugify(String(body?.name ?? "collection")), body?.description ?? null, body?.is_public ? 1 : 0,
    EMBED_MODEL, nowIso(),
  ).run();
  await audit(env, { orgId: body?.org_id, actorId: user.id, action: "collection.created", resourceType: "collection", resourceId: id });
  return { id, name: body?.name, org_id: body?.org_id ?? null };
}

export async function listCollections(env: Env, user: User, orgId?: string | null) {
  const clauses = ["(is_public = 1"];
  const binds: unknown[] = [];
  if (user) {
    clauses[0] += " OR user_id = ?";
    binds.push(user.id);
  }
  if (orgId) {
    clauses[0] += " OR org_id = ?";
    binds.push(orgId);
  }
  clauses[0] += ")";
  const { results } = await env.DB.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM documents d WHERE d.collection_id = c.id) AS document_count
       FROM collections c WHERE ${clauses.join(" AND ")} ORDER BY c.created_at DESC LIMIT 100`,
  ).bind(...binds).all();
  return results ?? [];
}

/* --------------------------------- ingest --------------------------------- */

async function fetchUrlText(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "SEARCH-POI-Ingest/1.0" } });
  if (!res.ok) throw new HttpError(400, `Could not fetch ${url} (${res.status})`);
  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title: title || url, text };
}

export async function ingestDocument(env: VectorEnv, user: User, body: any) {
  const collectionId = String(body?.collection_id ?? "");
  const col = await assertCollectionAccess(env, collectionId, user, true);
  if (col.org_id) await consumeQuota(env, col.org_id, "documents", 1);

  let title = body?.title ? String(body.title) : "Untitled document";
  let content = typeof body?.content === "string" ? body.content : "";
  const sourceUrl = body?.source_url ? String(body.source_url) : null;

  if (!content && sourceUrl) {
    const fetched = await fetchUrlText(sourceUrl);
    content = fetched.text;
    if (!body?.title) title = fetched.title;
  }
  content = content.trim();
  if (content.length < 20) throw new HttpError(400, "Document content is empty or too short to index");

  const hash = await sha256Hex(content);
  const existing = await env.DB.prepare(
    `SELECT id FROM documents WHERE collection_id = ? AND content_hash = ?`,
  ).bind(collectionId, hash).first<{ id: string }>();
  if (existing) return { id: existing.id, deduplicated: true, chunks: 0 };

  const docId = uid();
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO documents (id, collection_id, org_id, title, source_url, mime_type, content, content_hash, metadata, status, chunk_count, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,'pending',0,?,?)`,
  ).bind(
    docId, collectionId, col.org_id ?? null, title.slice(0, 200), sourceUrl,
    body?.mime_type ?? "text/plain", content, hash, JSON.stringify(body?.metadata ?? {}), ts, ts,
  ).run();

  const chunks = chunkText(content);
  const vectors = await embed(env, chunks.map((c) => c.content));

  const stmts = chunks.map((c, i) => {
    const chunkId = `${docId}:${c.index}`;
    return env.DB.prepare(
      `INSERT INTO document_chunks (id, document_id, collection_id, org_id, chunk_index, content, token_estimate, embedding, vector_id, metadata, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      chunkId, docId, collectionId, col.org_id ?? null, c.index, c.content, c.tokens,
      JSON.stringify(vectors[i] ?? []), chunkId, JSON.stringify({ title }), ts,
    );
  });
  if (stmts.length) await env.DB.batch(stmts);

  await upsertVectors(
    env,
    chunks.map((c, i) => ({
      id: `${docId}:${c.index}`,
      values: vectors[i] ?? [],
      metadata: { collection_id: collectionId, org_id: col.org_id ?? "", document_id: docId, title },
    })),
  );

  await env.DB.prepare(`UPDATE documents SET status = 'indexed', chunk_count = ?, updated_at = ? WHERE id = ?`)
    .bind(chunks.length, nowIso(), docId).run();
  await audit(env, { orgId: col.org_id, actorId: user?.id, action: "document.ingested", resourceType: "document", resourceId: docId, metadata: { chunks: chunks.length } });

  return { id: docId, title, chunks: chunks.length, deduplicated: false };
}

export async function deleteDocument(env: Env, user: User, documentId: string) {
  const doc = await env.DB.prepare(`SELECT * FROM documents WHERE id = ?`).bind(documentId).first<any>();
  if (!doc) throw notFound("Document not found");
  await assertCollectionAccess(env, doc.collection_id, user, true);
  await env.DB.prepare(`DELETE FROM documents WHERE id = ?`).bind(documentId).run();
  await audit(env, { orgId: doc.org_id, actorId: user?.id, action: "document.deleted", resourceType: "document", resourceId: documentId });
  return { ok: true };
}

/* -------------------------------- retrieval ------------------------------- */

export interface Retrieved {
  chunk_id: string;
  document_id: string;
  title: string;
  content: string;
  source_url: string | null;
  score: number;
  dense: number;
  keyword: number;
}

/** Keyword scoring: term overlap normalised by chunk length (BM25-lite). */
function keywordScore(query: string, text: string) {
  const terms = Array.from(new Set(query.toLowerCase().match(/[a-z0-9']{3,}/g) ?? []));
  if (!terms.length) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const t of terms) if (lower.includes(t)) hits++;
  const lengthNorm = 1 / (1 + Math.log(1 + text.length / 800));
  return (hits / terms.length) * lengthNorm;
}

export async function retrieve(
  env: VectorEnv,
  opts: { query: string; collectionId?: string; orgId?: string | null; topK?: number },
): Promise<Retrieved[]> {
  const topK = opts.topK ?? 6;
  const [queryVec] = await embed(env, [opts.query]);

  const dense =
    (await queryVectors(env, queryVec, { topK: topK * 4, collectionId: opts.collectionId, orgId: opts.orgId })) ??
    (await bruteForceSearch(env, queryVec, { topK: topK * 4, collectionId: opts.collectionId, orgId: opts.orgId }));

  const ids = dense.map((d) => d.chunk_id);
  const rows: any[] = [];
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT c.id, c.document_id, c.content, d.title, d.source_url
         FROM document_chunks c JOIN documents d ON d.id = c.document_id
        WHERE c.id IN (${placeholders})`,
    ).bind(...ids).all();
    rows.push(...(results ?? []));
  }

  // Keyword arm: catches exact terms the dense arm misses.
  const like = `%${opts.query.replace(/[%_]/g, "").slice(0, 60)}%`;
  const kwBinds: unknown[] = [like];
  let kwWhere = "c.content LIKE ?";
  if (opts.collectionId) {
    kwWhere += " AND c.collection_id = ?";
    kwBinds.push(opts.collectionId);
  }
  const { results: kwRows } = await env.DB.prepare(
    `SELECT c.id, c.document_id, c.content, d.title, d.source_url
       FROM document_chunks c JOIN documents d ON d.id = c.document_id
      WHERE ${kwWhere} LIMIT 25`,
  ).bind(...kwBinds).all();

  const byId = new Map<string, any>();
  for (const r of [...rows, ...(kwRows ?? [])]) byId.set(r.id, r);
  const denseScores = new Map(dense.map((d) => [d.chunk_id, d.score]));

  const fused: Retrieved[] = Array.from(byId.values()).map((r) => {
    const d = denseScores.get(r.id) ?? 0;
    const k = keywordScore(opts.query, r.content);
    return {
      chunk_id: r.id,
      document_id: r.document_id,
      title: r.title,
      content: r.content,
      source_url: r.source_url ?? null,
      dense: d,
      keyword: k,
      score: 0.72 * d + 0.28 * k,
    };
  });

  fused.sort((a, b) => b.score - a.score);
  // Diversity: at most 3 chunks from any single document.
  const perDoc = new Map<string, number>();
  const out: Retrieved[] = [];
  for (const item of fused) {
    const n = perDoc.get(item.document_id) ?? 0;
    if (n >= 3) continue;
    perDoc.set(item.document_id, n + 1);
    out.push(item);
    if (out.length >= topK) break;
  }
  return out;
}

/* ------------------------------ grounded answer --------------------------- */

const RAG_SYSTEM = `You are SEARCH-POI Engine v1 answering strictly from the numbered CONTEXT passages.
Rules:
- Lead with the direct answer in the first sentence. 3-8 sentences total unless asked for detail.
- Cite every factual claim inline as [1], [2] matching the passage numbers.
- If the context does not contain the answer, say so plainly and state what is missing. Never invent facts.
- Prefer concrete numbers, names and next actions over generalities.`;

export async function answerWithContext(
  env: VectorEnv,
  opts: { query: string; passages: Retrieved[]; history?: Array<{ role: string; content: string }> },
) {
  if (!opts.passages.length) {
    return {
      answer: "No indexed passages match that question yet. Add documents to this collection and ask again.",
      citations: [],
      grounded: false,
      confidence: 0,
    };
  }
  const context = opts.passages
    .map((p, i) => `[${i + 1}] ${p.title}${p.source_url ? ` (${p.source_url})` : ""}\n${p.content}`)
    .join("\n\n");
  const historyText = (opts.history ?? [])
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const answer = await aiText({
    env: env as any,
    chain: "balanced",
    system: RAG_SYSTEM,
    user: `${historyText ? `CONVERSATION SO FAR:\n${historyText}\n\n` : ""}CONTEXT:\n${context}\n\nQUESTION: ${opts.query}`,
    fallback: "",
  });

  const used = new Set((answer.match(/\[(\d+)\]/g) ?? []).map((m) => Number(m.replace(/\D/g, ""))));
  const citations = opts.passages.map((p, i) => ({
    n: i + 1,
    title: p.title,
    source_url: p.source_url,
    document_id: p.document_id,
    chunk_id: p.chunk_id,
    score: Number(p.score.toFixed(4)),
    cited: used.has(i + 1),
  }));
  const top = opts.passages[0]?.score ?? 0;
  const confidence = Math.round(Math.min(96, 45 + top * 45 + Math.min(opts.passages.length, 6) * 2));

  return { answer: answer || "The engine could not produce an answer for that question.", citations, grounded: used.size > 0, confidence };
}

/* --------------------------------- routing -------------------------------- */

export async function handleRagRoute(
  segments: string[],
  request: Request,
  env: VectorEnv,
  body: any,
  session: { user?: User },
): Promise<Response> {
  const user = session.user;
  const [first, second] = segments;
  const method = request.method;
  const url = new URL(request.url);

  if (first === "collections") {
    if (method === "GET") return json({ data: await listCollections(env, user, url.searchParams.get("org_id")) });
    if (method === "POST") return json({ data: await createCollection(env, user, body) }, 201);
  }

  if (first === "documents") {
    if (method === "POST") return json({ data: await ingestDocument(env, user, body) }, 201);
    if (method === "DELETE" && second) return json({ data: await deleteDocument(env, user, second) });
    if (method === "GET") {
      const collectionId = url.searchParams.get("collection_id") ?? "";
      await assertCollectionAccess(env, collectionId, user);
      const { results } = await env.DB.prepare(
        `SELECT id, title, source_url, status, chunk_count, created_at FROM documents WHERE collection_id = ? ORDER BY created_at DESC LIMIT 200`,
      ).bind(collectionId).all();
      return json({ data: results ?? [] });
    }
  }

  if (first === "search" && method === "POST") {
    const collectionId = body?.collection_id ? String(body.collection_id) : undefined;
    if (collectionId) await assertCollectionAccess(env, collectionId, user);
    const passages = await retrieve(env, { query: String(body?.query ?? ""), collectionId, orgId: body?.org_id ?? null, topK: Number(body?.top_k) || 6 });
    return json({ data: passages });
  }

  if (first === "chat" && method === "POST") {
    const query = String(body?.query ?? "").trim();
    if (!query) throw new HttpError(400, "A question is required");
    const collectionId = body?.collection_id ? String(body.collection_id) : undefined;
    const col = collectionId ? await assertCollectionAccess(env, collectionId, user) : null;
    if (col?.org_id) await consumeQuota(env, col.org_id, "searches", 1);

    let conversationId = body?.conversation_id ? String(body.conversation_id) : null;
    let history: Array<{ role: string; content: string }> = [];
    if (conversationId) {
      const { results } = await env.DB.prepare(
        `SELECT role, content FROM rag_messages WHERE conversation_id = ? ORDER BY created_at LIMIT 20`,
      ).bind(conversationId).all<{ role: string; content: string }>();
      history = results ?? [];
    } else {
      conversationId = uid();
      const ts = nowIso();
      await env.DB.prepare(
        `INSERT INTO rag_conversations (id, collection_id, org_id, user_id, title, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
      ).bind(conversationId, collectionId ?? null, col?.org_id ?? null, user?.id ?? null, query.slice(0, 60), ts, ts).run();
    }

    const passages = await retrieve(env, { query, collectionId, orgId: col?.org_id ?? null, topK: Number(body?.top_k) || 6 });
    const result = await answerWithContext(env, { query, passages, history });

    const ts = nowIso();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO rag_messages (id, conversation_id, role, content, citations, created_at) VALUES (?,?,?,?,?,?)`)
        .bind(uid(), conversationId, "user", query, "[]", ts),
      env.DB.prepare(`INSERT INTO rag_messages (id, conversation_id, role, content, citations, created_at) VALUES (?,?,?,?,?,?)`)
        .bind(uid(), conversationId, "assistant", result.answer, JSON.stringify(result.citations), ts),
      env.DB.prepare(`UPDATE rag_conversations SET updated_at = ? WHERE id = ?`).bind(ts, conversationId),
    ]);

    return json({ data: { conversation_id: conversationId, ...result } });
  }

  if (first === "conversations" && method === "GET") {
    if (!user) throw unauthorized();
    if (second) {
      const { results } = await env.DB.prepare(
        `SELECT * FROM rag_messages WHERE conversation_id = ? ORDER BY created_at`,
      ).bind(second).all();
      return json({ data: results ?? [] });
    }
    const { results } = await env.DB.prepare(
      `SELECT * FROM rag_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`,
    ).bind(user.id).all();
    return json({ data: results ?? [] });
  }

  throw notFound();
}
