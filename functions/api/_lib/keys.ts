/**
 * Public API key generator + validator for the SEARCH-POI ENGINE v1 public API.
 *
 * Keys are stored in the Cloudflare KV namespace bound as `env.API_KEYS`.
 * Each key is a JSON record:
 *   { api_key: string, created_at: string, is_active: boolean }
 *
 * The raw key string is used directly as the KV key, and is never hashed: KV is
 * already a secret store with per-key access, and the public `/generate-key`
 * flow needs to look the key up by the exact value the caller presents.
 */

import type { Env } from "./auth";

const PREFIX = "spoi_live_sk_";
const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Generate a cryptographically random API key, e.g. `spoi_live_sk_aB3...`. */
export function generateApiKey(length = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return PREFIX + body;
}

export interface ApiKeyRecord {
  api_key: string;
  created_at: string;
  is_active: boolean;
}

/** Extract the API key from the request (header `x-api-key` or `?api_key=`). */
export function extractApiKey(request: Request, url: URL): string | null {
  const header = request.headers.get("x-api-key");
  if (header && header.trim()) return header.trim();
  const query = url.searchParams.get("api_key");
  if (query && query.trim()) return query.trim();
  return null;
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

/** POST /api/generate-key — create a key and persist it to KV. */
export async function generateKeyRoute(request: Request, env: Env): Promise<Response> {
  if (!env.API_KEYS) {
    return json({ error: "API_KEYS KV namespace is not bound" }, 503);
  }

  const apiKey = generateApiKey(32);
  const record: ApiKeyRecord = {
    api_key: apiKey,
    created_at: new Date().toISOString(),
    is_active: true,
  };

  await env.API_KEYS.put(apiKey, JSON.stringify(record));

  return json({ api_key: apiKey, status: "success" });
}

/** POST /api/revoke-key — mark a key as inactive in KV. */
export async function revokeKeyRoute(request: Request, env: Env): Promise<Response> {
  if (!env.API_KEYS) {
    return json({ error: "API_KEYS KV namespace is not bound" }, 503);
  }

  let body: { api_key?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be JSON" }, 400);
  }

  const apiKey = (body.api_key || "").trim();
  if (!apiKey) {
    return json({ error: "api_key is required" }, 400);
  }

  const raw = await env.API_KEYS.get(apiKey);
  if (!raw) {
    return json({ error: "API key not found" }, 404);
  }

  const record: ApiKeyRecord = JSON.parse(raw);
  record.is_active = false;
  await env.API_KEYS.put(apiKey, JSON.stringify(record));

  return json({ api_key: apiKey, status: "revoked" });
}

/**
 * Auth middleware for the public API. Returns null if the request is allowed,
 * or a 401 Response if the key is missing / invalid / revoked.
 */
export async function requireApiKey(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (!env.API_KEYS) {
    return json({ error: "API_KEYS KV namespace is not bound" }, 503);
  }

  const apiKey = extractApiKey(request, url);
  if (!apiKey) {
    return json({ error: "Invalid API key" }, 401);
  }

  const raw = await env.API_KEYS.get(apiKey);
  if (!raw) {
    return json({ error: "Invalid API key" }, 401);
  }

  let record: ApiKeyRecord;
  try {
    record = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid API key" }, 401);
  }

  if (!record.is_active) {
    return json({ error: "Invalid API key" }, 401);
  }

  return null;
}
