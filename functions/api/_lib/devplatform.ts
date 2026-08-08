/**
 * Developer platform: versioned public API (`/api/v1`), OpenAPI 3.1 document,
 * GraphQL endpoint, OAuth2 client-credentials, webhooks with HMAC signing and
 * retry, plus per-key rate limiting.
 */

import type { Env } from "./auth";
import { retrieve, answerWithContext } from "./rag";
import type { VectorEnv } from "./embeddings";
import { consumeQuota } from "./tenancy";
import { forbidden, HttpError, json, notFound, nowIso, rateLimit, sha256Hex, uid, unauthorized } from "./util";

/* ------------------------------- API keys -------------------------------- */

export interface ApiKeyContext {
  id: string;
  user_id: string;
  org_id: string | null;
  scopes: string[];
  name: string;
}

export async function authenticateApiKey(env: Env, request: Request): Promise<ApiKeyContext | null> {
  const raw =
    request.headers.get("X-API-Key") ||
    (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!raw) return null;
  const hash = await sha256Hex(raw);
  const row = await env.DB.prepare(
    `SELECT id, user_id, name, key_hash, is_active FROM api_keys WHERE key_hash = ?`,
  ).bind(hash).first<any>();
  if (!row || row.is_active === 0) return null;
  await env.DB.prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`).bind(nowIso(), row.id).run().catch(() => {});
  return { id: row.id, user_id: row.user_id, org_id: row.org_id ?? null, scopes: (row.scopes ?? "search:read").split(/[ ,]+/), name: row.name };
}

export function requireScope(ctx: ApiKeyContext, scope: string) {
  if (!ctx.scopes.includes(scope) && !ctx.scopes.includes("*")) throw forbidden(`API key is missing the ${scope} scope`);
}

/* -------------------------------- webhooks -------------------------------- */

async function sign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function dispatchWebhook(env: Env, event: string, payload: unknown, orgId?: string | null) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM webhooks WHERE active = 1 AND (org_id IS ? OR org_id = ?)`,
  ).bind(orgId ?? null, orgId ?? "").all<any>();

  for (const hook of results ?? []) {
    const events: string[] = JSON.parse(hook.events || "[]");
    if (events.length && !events.includes(event) && !events.includes("*")) continue;
    const bodyText = JSON.stringify({ event, created_at: nowIso(), data: payload });
    const signature = await sign(hook.secret, bodyText);
    const deliveryId = uid();
    let status: number | null = null;
    let error: string | null = null;
    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-POI-Event": event,
          "X-POI-Signature": `sha256=${signature}`,
          "X-POI-Delivery": deliveryId,
        },
        body: bodyText,
      });
      status = res.status;
      if (!res.ok) error = (await res.text()).slice(0, 300);
    } catch (e) {
      error = String(e).slice(0, 300);
    }
    await env.DB.prepare(
      `INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status_code, error, attempts, delivered_at, created_at)
       VALUES (?,?,?,?,?,?,1,?,?)`,
    ).bind(deliveryId, hook.id, event, bodyText.slice(0, 4000), status, error, status && status < 400 ? nowIso() : null, nowIso()).run();
  }
}

/** Re-attempts deliveries that failed, with exponential backoff by attempt count. */
export async function retryWebhooks(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT d.*, w.url, w.secret FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id
      WHERE d.delivered_at IS NULL AND d.attempts < 5 LIMIT 25`,
  ).all<any>();
  for (const d of results ?? []) {
    const backoffMs = 2 ** d.attempts * 60000;
    if (Date.now() - new Date(d.created_at).getTime() < backoffMs) continue;
    const signature = await sign(d.secret, d.payload);
    try {
      const res = await fetch(d.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-POI-Event": d.event, "X-POI-Signature": `sha256=${signature}`, "X-POI-Delivery": d.id },
        body: d.payload,
      });
      await env.DB.prepare(`UPDATE webhook_deliveries SET attempts = attempts + 1, status_code = ?, delivered_at = ? WHERE id = ?`)
        .bind(res.status, res.ok ? nowIso() : null, d.id).run();
    } catch (e) {
      await env.DB.prepare(`UPDATE webhook_deliveries SET attempts = attempts + 1, error = ? WHERE id = ?`).bind(String(e).slice(0, 300), d.id).run();
    }
  }
}

/* ------------------------------ OpenAPI 3.1 ------------------------------- */

export function openApiDocument(origin: string) {
  const okJson = (schema: Record<string, unknown>) => ({
    description: "Success",
    content: { "application/json": { schema } },
  });
  return {
    openapi: "3.1.0",
    info: {
      title: "SEARCH-POI Engine v1 API",
      version: "1.0.0",
      description:
        "Intelligent reasoning search for African markets. Authenticate with an API key (`X-API-Key`) or an OAuth2 client-credentials token.",
      contact: { name: "SEARCH-POI", url: `${origin}/docs` },
    },
    servers: [{ url: `${origin}/api/v1` }],
    security: [{ ApiKeyAuth: [] }, { OAuth2: ["search:read"] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
        OAuth2: {
          type: "oauth2",
          flows: { clientCredentials: { tokenUrl: `${origin}/api/v1/oauth/token`, scopes: { "search:read": "Run searches", "documents:write": "Index documents" } } },
        },
      },
      schemas: {
        Answer: {
          type: "object",
          properties: {
            answer: { type: "string" },
            confidence: { type: "integer" },
            citations: { type: "array", items: { type: "object" } },
            model: { type: "string" },
          },
        },
        Error: { type: "object", properties: { error: { type: "string" } } },
      },
    },
    paths: {
      "/query": {
        post: {
          summary: "Ask the reasoning engine",
          operationId: "query",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["query"],
                  properties: {
                    query: { type: "string" },
                    mode: { type: "string", enum: ["default", "deep_research", "business", "academic", "code"] },
                    collection_id: { type: "string", description: "Restrict the answer to one RAG collection" },
                  },
                },
              },
            },
          },
          responses: { "200": okJson({ $ref: "#/components/schemas/Answer" }), "429": okJson({ $ref: "#/components/schemas/Error" }) },
        },
      },
      "/search": {
        get: {
          summary: "Retrieve ranked passages without generation",
          operationId: "search",
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string" } },
            { name: "collection_id", in: "query", schema: { type: "string" } },
            { name: "top_k", in: "query", schema: { type: "integer", default: 6 } },
          ],
          responses: { "200": okJson({ type: "array", items: { type: "object" } }) },
        },
      },
      "/places": {
        get: {
          summary: "Live points of interest near a location",
          operationId: "places",
          parameters: [
            { name: "near", in: "query", required: true, schema: { type: "string" }, description: "City, area or 'lat,lng'" },
            { name: "category", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": okJson({ type: "array", items: { type: "object" } }) },
        },
      },
      "/documents": {
        post: {
          summary: "Index a document into a collection",
          operationId: "ingest",
          responses: { "201": okJson({ type: "object" }) },
        },
      },
      "/usage": { get: { summary: "Current API usage and limits", operationId: "usage", responses: { "200": okJson({ type: "object" }) } } },
      "/oauth/token": {
        post: {
          summary: "Exchange client credentials for an access token",
          operationId: "token",
          security: [],
          responses: { "200": okJson({ type: "object" }) },
        },
      },
    },
  };
}

/* -------------------------------- GraphQL --------------------------------- */

const GRAPHQL_SCHEMA = `type Citation { n: Int, title: String, sourceUrl: String, score: Float }
type Answer { answer: String!, confidence: Int!, citations: [Citation!]! }
type Passage { id: String!, title: String, content: String!, score: Float! }
type Query {
  ask(query: String!, collectionId: String): Answer!
  search(query: String!, collectionId: String, topK: Int): [Passage!]!
}`;

/** Minimal GraphQL executor: supports the two documented root fields. */
async function executeGraphql(env: VectorEnv, query: string, variables: Record<string, any>) {
  const op = /\b(ask|search)\s*\(/.exec(query)?.[1];
  const arg = (name: string) =>
    variables[name] ?? new RegExp(`${name}\\s*:\\s*"([^"]*)"`).exec(query)?.[1] ?? undefined;
  const q = arg("query") ?? variables.query;
  if (!op || !q) return { errors: [{ message: "Supported operations: ask(query), search(query). Provide a `query` argument." }] };
  const collectionId = arg("collectionId");
  const passages = await retrieve(env, { query: q, collectionId, topK: Number(variables.topK) || 6 });

  if (op === "search") {
    return { data: { search: passages.map((p) => ({ id: p.chunk_id, title: p.title, content: p.content, score: p.score })) } };
  }
  const result = await answerWithContext(env, { query: q, passages });
  return {
    data: {
      ask: {
        answer: result.answer,
        confidence: result.confidence,
        citations: result.citations.map((c) => ({ n: c.n, title: c.title, sourceUrl: c.source_url, score: c.score })),
      },
    },
  };
}

/* --------------------------------- routing -------------------------------- */

export async function handleV1Route(
  segments: string[],
  request: Request,
  env: VectorEnv,
  body: any,
): Promise<Response> {
  const url = new URL(request.url);
  const [first, second] = segments;

  if (first === "openapi.json" || (first === "openapi" && !second)) {
    return json(openApiDocument(url.origin), 200, { "Cache-Control": "public, max-age=300" });
  }
  if (first === "graphql") {
    if (request.method === "GET") return json({ schema: GRAPHQL_SCHEMA });
    const ctx = await authenticateApiKey(env, request);
    if (!ctx) throw unauthorized("Provide an API key in the X-API-Key header");
    return json(await executeGraphql(env, String(body?.query ?? ""), body?.variables ?? {}));
  }

  if (first === "oauth" && second === "token" && request.method === "POST") {
    const clientId = String(body?.client_id ?? "");
    const clientSecret = String(body?.client_secret ?? "");
    const row = await env.DB.prepare(`SELECT * FROM oauth_clients WHERE client_id = ?`).bind(clientId).first<any>();
    if (!row || row.client_secret_hash !== (await sha256Hex(clientSecret))) throw unauthorized("Invalid client credentials");
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expires = new Date(Date.now() + 3600_000).toISOString();
    await env.DB.prepare(
      `INSERT INTO oauth_tokens (id, client_id, user_id, access_token, scopes, expires_at, created_at) VALUES (?,?,?,?,?,?,?)`,
    ).bind(uid(), clientId, null, token, row.scopes, expires, nowIso()).run();
    return json({ access_token: token, token_type: "Bearer", expires_in: 3600, scope: row.scopes });
  }

  /* ---- everything below requires an API key ---- */
  const ctx = await authenticateApiKey(env, request);
  if (!ctx) throw unauthorized("Provide an API key in the X-API-Key header");

  const limit = await rateLimit(env, `api:${ctx.id}`, 60, 60);
  const headers = {
    "X-RateLimit-Limit": "60",
    "X-RateLimit-Remaining": String(limit.remaining),
    "X-RateLimit-Reset": String(limit.reset),
  };
  if (!limit.allowed) return json({ error: "Rate limit exceeded (60 requests/minute)" }, 429, headers);
  if (ctx.org_id) await consumeQuota(env, ctx.org_id, "api_calls", 1);

  const logCall = async (endpoint: string, status: number, started: number) => {
    await env.DB.prepare(
      `INSERT INTO api_usage_log (id, api_key_id, endpoint, status_code, response_ms, created_at) VALUES (?,?,?,?,?,?)`,
    ).bind(uid(), ctx.id, endpoint, status, Date.now() - started, nowIso()).run().catch(() => {});
  };
  const started = Date.now();

  if (first === "query" && request.method === "POST") {
    requireScope(ctx, "search:read");
    const q = String(body?.query ?? "").trim();
    if (!q) throw new HttpError(400, "`query` is required");
    const passages = await retrieve(env, { query: q, collectionId: body?.collection_id, orgId: ctx.org_id, topK: Number(body?.top_k) || 6 });
    const result = await answerWithContext(env, { query: q, passages });
    await logCall("/v1/query", 200, started);
    await dispatchWebhook(env, "query.completed", { query: q, confidence: result.confidence }, ctx.org_id);
    return json({ data: result }, 200, headers);
  }

  if (first === "search" && request.method === "GET") {
    requireScope(ctx, "search:read");
    const q = url.searchParams.get("q") ?? "";
    const passages = await retrieve(env, {
      query: q,
      collectionId: url.searchParams.get("collection_id") ?? undefined,
      orgId: ctx.org_id,
      topK: Number(url.searchParams.get("top_k")) || 6,
    });
    await logCall("/v1/search", 200, started);
    return json({ data: passages }, 200, headers);
  }

  if (first === "usage" && request.method === "GET") {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS calls, AVG(response_ms) AS avg_ms FROM api_usage_log WHERE api_key_id = ? AND created_at >= ?`,
    ).bind(ctx.id, new Date(Date.now() - 30 * 864e5).toISOString()).first();
    return json({ data: { key: ctx.name, scopes: ctx.scopes, last_30_days: row } }, 200, headers);
  }

  throw notFound(`Unknown v1 endpoint: /${segments.join("/")}`);
}
