/**
 * Unit tests for the public API key generator + validator (functions/api/_lib/keys.ts).
 *
 * Uses a tiny in-memory KV mock and verifies the full lifecycle:
 *   generate → validate (header + query) → revoke → blocked after revoke.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateApiKey,
  generateKeyRoute,
  revokeKeyRoute,
  requireApiKey,
  extractApiKey,
} from "../../functions/api/_lib/keys";

// Minimal in-memory KVNamespace mock: only the methods keys.ts uses.
function makeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    // list/getWithMetadata not used by keys.ts but satisfy the interface.
  } as unknown as KVNamespace;
}

function makeEnv(kv: KVNamespace) {
  return { DB: undefined, API_KEYS: kv } as any;
}

function makeRequest(url: string, init: RequestInit = {}) {
  return new Request(url, init);
}

describe("keys.ts — public API key lifecycle", () => {
  let kv: KVNamespace;
  let env: any;

  beforeEach(() => {
    kv = makeKv();
    env = makeEnv(kv);
  });

  it("generateApiKey produces spoi_live_sk_-prefixed keys of expected length", () => {
    const key = generateApiKey(32);
    expect(key.startsWith("spoi_live_sk_")).toBe(true);
    expect(key.length).toBe("spoi_live_sk_".length + 32);
    // Two calls must not collide (probabilistically).
    expect(generateApiKey(32)).not.toBe(key);
  });

  it("POST /api/generate-key returns a key and stores an active record in KV", async () => {
    const res = await generateKeyRoute(makeRequest("https://x/api/generate-key", { method: "POST" }), env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(typeof body.api_key).toBe("string");
    expect(body.api_key.startsWith("spoi_live_sk_")).toBe(true);

    const raw = await kv.get(body.api_key);
    expect(raw).not.toBeNull();
    const record = JSON.parse(raw!);
    expect(record.api_key).toBe(body.api_key);
    expect(record.is_active).toBe(true);
    expect(typeof record.created_at).toBe("string");
  });

  it("requireApiKey returns null (allow) when a valid key is sent via x-api-key header", async () => {
    const gen = await generateKeyRoute(makeRequest("https://x/api/generate-key", { method: "POST" }), env);
    const { api_key } = await gen.json();

    const req = makeRequest("https://x/api/search?q=abuja", {
      headers: { "x-api-key": api_key },
    });
    const result = await requireApiKey(req, env, new URL(req.url));
    expect(result).toBeNull();
  });

  it("requireApiKey returns null when the key is sent via ?api_key=", async () => {
    const gen = await generateKeyRoute(makeRequest("https://x/api/generate-key", { method: "POST" }), env);
    const { api_key } = await gen.json();

    const req = makeRequest(`https://x/api/search?q=abuja&api_key=${api_key}`);
    const result = await requireApiKey(req, env, new URL(req.url));
    expect(result).toBeNull();
  });

  it("requireApiKey returns 401 when no key is present", async () => {
    const req = makeRequest("https://x/api/search?q=abuja");
    const result = await requireApiKey(req, env, new URL(req.url));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json();
    expect(body.error).toBe("Invalid API key");
  });

  it("requireApiKey returns 401 for an unknown / fabricated key", async () => {
    const req = makeRequest("https://x/api/search?q=abuja", {
      headers: { "x-api-key": "spoi_live_sk_fake" },
    });
    const result = await requireApiKey(req, env, new URL(req.url));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("POST /api/revoke-key sets is_active=false and subsequent calls are blocked", async () => {
    const gen = await generateKeyRoute(makeRequest("https://x/api/generate-key", { method: "POST" }), env);
    const { api_key } = await gen.json();

    // Before revoke: allowed.
    const okReq = makeRequest("https://x/api/search?q=abuja", { headers: { "x-api-key": api_key } });
    expect(await requireApiKey(okReq, env, new URL(okReq.url))).toBeNull();

    // Revoke.
    const revReq = makeRequest("https://x/api/revoke-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key }),
    });
    const revRes = await revokeKeyRoute(revReq, env);
    expect(revRes.status).toBe(200);
    const revBody = await revRes.json();
    expect(revBody.status).toBe("revoked");

    // KV record now inactive.
    const raw = await kv.get(api_key);
    expect(JSON.parse(raw!).is_active).toBe(false);

    // After revoke: 401.
    const blocked = await requireApiKey(okReq, env, new URL(okReq.url));
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(401);
  });

  it("POST /api/revoke-key returns 404 for a key that was never issued", async () => {
    const revReq = makeRequest("https://x/api/revoke-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: "spoi_live_sk_never_existed" }),
    });
    const res = await revokeKeyRoute(revReq, env);
    expect(res.status).toBe(404);
  });

  it("POST /api/revoke-key returns 400 when api_key is missing from body", async () => {
    const revReq = makeRequest("https://x/api/revoke-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await revokeKeyRoute(revReq, env);
    expect(res.status).toBe(400);
  });

  it("extractApiKey reads header first, then query string", () => {
    expect(extractApiKey(makeRequest("https://x", { headers: { "x-api-key": "hk" } }), new URL("https://x"))).toBe("hk");
    expect(extractApiKey(makeRequest("https://x?api_key=qk"), new URL("https://x?api_key=qk"))).toBe("qk");
    expect(extractApiKey(makeRequest("https://x"), new URL("https://x"))).toBeNull();
  });

  it("returns 503 when the API_KEYS KV namespace is not bound", async () => {
    const noBindingEnv = { DB: undefined } as any;
    const gen = await generateKeyRoute(makeRequest("https://x/api/generate-key", { method: "POST" }), noBindingEnv);
    expect(gen.status).toBe(503);
    const authRes = await requireApiKey(makeRequest("https://x/api/search"), noBindingEnv, new URL("https://x/api/search"));
    expect(authRes!.status).toBe(503);
  });
});

/**
 * Router-level integration test: simulates how [[route]].ts dispatches
 * /api/generate-key, /api/search (with + without key) and /api/revoke-key,
 * using the real requireApiKey gate and a stubbed factSearchRoute so no D1
 * binding is required.
 */
describe("router integration — generate → search → revoke", () => {
  // Re-implement the tiny router slice under test from [[route]].ts.
  async function dispatch(head: string, request: Request, env: any, url: URL) {
    if (head === "generate-key" && request.method === "POST") {
      return generateKeyRoute(request, env);
    }
    if (head === "revoke-key" && request.method === "POST") {
      return revokeKeyRoute(request, env);
    }
    if (head === "search") {
      const authErr = await requireApiKey(request, env, url);
      if (authErr) return authErr;
      // Stand-in for factSearchRoute — proves the request reached the handler.
      return new Response(JSON.stringify({ ok: true, results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  let env: any;
  beforeEach(() => {
    env = { API_KEYS: makeKv() };
  });

  it("401 without a key, 200 with header key, 401 after revoke", async () => {
    // No key -> 401.
    const noKey = await dispatch("search", makeRequest("https://x/api/search?q=abuja"), env, new URL("https://x/api/search?q=abuja"));
    expect(noKey.status).toBe(401);

    // Generate.
    const gen = await dispatch("generate-key", makeRequest("https://x/api/generate-key", { method: "POST" }), env, new URL("https://x/api/generate-key"));
    expect(gen.status).toBe(200);
    const { api_key } = await gen.json();

    // Header auth -> 200.
    const withHeader = await dispatch(
      "search",
      makeRequest("https://x/api/search?q=abuja", { headers: { "x-api-key": api_key } }),
      env,
      new URL("https://x/api/search?q=abuja"),
    );
    expect(withHeader.status).toBe(200);
    expect((await withHeader.json()).ok).toBe(true);

    // Query auth -> 200.
    const withQuery = await dispatch(
      "search",
      makeRequest(`https://x/api/search?q=abuja&api_key=${api_key}`),
      env,
      new URL(`https://x/api/search?q=abuja&api_key=${api_key}`),
    );
    expect(withQuery.status).toBe(200);

    // Revoke.
    const rev = await dispatch(
      "revoke-key",
      makeRequest("https://x/api/revoke-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key }),
      }),
      env,
      new URL("https://x/api/revoke-key"),
    );
    expect(rev.status).toBe(200);

    // After revoke -> 401.
    const afterRevoke = await dispatch(
      "search",
      makeRequest("https://x/api/search?q=abuja", { headers: { "x-api-key": api_key } }),
      env,
      new URL("https://x/api/search?q=abuja"),
    );
    expect(afterRevoke.status).toBe(401);
  });
});
