/**
 * POI data layer + platform diagnostics.
 *
 * Everything here is defensive: if the D1 binding is missing, the table does
 * not exist, or a query blows up, the caller gets a JSON payload that says
 * exactly which button to click in the Cloudflare dashboard.
 */

import type { Env } from "./auth";
import { json } from "./util";

export interface AnyEnv extends Env {
  DATABASE?: D1Database;
  D1?: D1Database;
  AI?: { run: (model: string, input: unknown) => Promise<any> };
  [key: string]: unknown;
}

export const HELP = "Check Cloudflare Pages > Functions > View logs";
export const BIND_HELP =
  "Open Cloudflare Dashboard > Workers & Pages > search-poi > Settings > Bindings > Add D1 database binding named 'DB' pointing at 'search-poi-db', then Retry deployment.";

/** Resolve the D1 binding, trying DB then DATABASE then D1. */
export function resolveDb(env: AnyEnv): { db: D1Database | null; binding: string | null } {
  for (const name of ["DB", "DATABASE", "D1"] as const) {
    const candidate = (env as any)[name];
    if (candidate && typeof candidate.prepare === "function") return { db: candidate, binding: name };
  }
  return { db: null, binding: null };
}

const SEED = [
  ["Abuja National Mosque", "Central mosque in Abuja", 9.0615, 7.5156],
  ["Jabi Lake Mall", "Shopping mall in Jabi", 9.0667, 7.4333],
  ["Aso Rock", "Presidential villa rock formation", 9.0833, 7.5333],
] as const;

/**
 * Guarantee the `pois` table exists and holds at least the seed rows.
 * Uses the project's canonical schema (TEXT id, lat/lon) so semantic search
 * keeps working; `latitude`/`longitude` are accepted as input aliases.
 */
export async function ensurePois(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS pois (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         category TEXT,
         address TEXT,
         phone TEXT,
         website TEXT,
         lat REAL,
         lon REAL,
         city TEXT,
         country TEXT,
         source TEXT DEFAULT 'osm',
         trust_score INTEGER DEFAULT 70,
         embedding TEXT,
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
       )`,
    )
    .run();

  const count = await db.prepare(`SELECT COUNT(*) AS n FROM pois`).first<{ n: number }>();
  if ((count?.n ?? 0) > 0) return;

  const stmt = db.prepare(
    `INSERT INTO pois (id, name, address, lat, lon, city, country, source) VALUES (?,?,?,?,?,?,?,'seed')`,
  );
  await db.batch(
    SEED.map(([name, description, lat, lon]) =>
      stmt.bind(crypto.randomUUID(), name, description, lat, lon, "Abuja", "NG"),
    ),
  );
}

const shape = (r: Record<string, any>) => ({
  ...r,
  description: r.address ?? null,
  latitude: r.lat,
  longitude: r.lon,
});

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

const fail = (message: string, status = 500, extra: Record<string, unknown> = {}) =>
  json({ error: "Server Error", details: message, help: HELP, ...extra }, status);

const noBinding = () =>
  json({ error: "Server Error", details: "No D1 binding found", help: BIND_HELP }, 503);

/* --------------------------------- health -------------------------------- */

export async function healthRoute(env: AnyEnv): Promise<Response> {
  const { db, binding } = resolveDb(env);
  if (!db) return json({ status: "error", message: "No D1 binding found", help: BIND_HELP }, 503);

  const checks: Record<string, { ok: boolean; detail: string }> = {};

  try {
    await ensurePois(db);
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM pois`).first<{ n: number }>();
    checks.d1 = { ok: true, detail: `${row?.n ?? 0} POIs in '${binding}'` };
  } catch (e) {
    checks.d1 = { ok: false, detail: (e as Error).message };
  }

  if (env.CACHE) {
    try {
      const key = "health:ping";
      await env.CACHE.put(key, String(Date.now()), { expirationTtl: 60 });
      checks.kv = { ok: Boolean(await env.CACHE.get(key)), detail: "KV read/write OK" };
    } catch (e) {
      checks.kv = { ok: false, detail: (e as Error).message };
    }
  } else {
    checks.kv = { ok: false, detail: "CACHE binding missing — add a KV namespace binding named CACHE" };
  }

  if (env.AI) {
    try {
      const res = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: ["ping"] });
      const dims = (res?.data?.[0] ?? res?.embeddings?.[0] ?? []).length;
      checks.ai = { ok: dims > 0, detail: dims ? `Workers AI embeddings OK (${dims} dims)` : "AI returned no vector" };
    } catch (e) {
      checks.ai = { ok: false, detail: (e as Error).message };
    }
  } else {
    checks.ai = { ok: false, detail: "AI binding missing — add the Workers AI binding named AI" };
  }

  checks.config = {
    ok: Boolean(env.GROQ_API_KEY || env.OPENROUTER_API_KEY || env.GEMINI_API_KEY || env.AI),
    ok_detail: "",
    detail: [
      `google auth: ${env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? "on" : "off"}`,
      `llm keys: ${["GROQ_API_KEY", "OPENROUTER_API_KEY", "GEMINI_API_KEY"].filter((k) => (env as any)[k]).length}/3`,
      `storage: ${env.BUCKET ? "on" : "off"}`,
    ].join(" · "),
  } as any;

  const status = Object.values(checks).every((c) => c.ok) ? "ok" : "degraded";
  return json({ status, binding_used: binding, checks, checked_at: new Date().toISOString() });
}

export async function debugRoute(env: AnyEnv): Promise<Response> {
  const { db, binding } = resolveDb(env);
  const env_keys = Object.keys(env).filter((k) => !/KEY|SECRET|TOKEN|PASSWORD/i.test(k));
  if (!db) return json({ binding_found: false, table_exists: false, row_count: 0, env_keys, help: BIND_HELP });

  let table_exists = false;
  let row_count = 0;
  let details: string | null = null;
  try {
    const t = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pois'`)
      .first<{ name: string }>();
    table_exists = Boolean(t);
    if (table_exists) {
      row_count = (await db.prepare(`SELECT COUNT(*) AS n FROM pois`).first<{ n: number }>())?.n ?? 0;
    }
  } catch (e) {
    details = (e as Error).message;
  }
  return json({ binding_found: true, binding_used: binding, table_exists, row_count, env_keys, details, help: HELP });
}

/* ---------------------------------- POIs --------------------------------- */

export async function poisRoute(rest: string[], request: Request, env: AnyEnv, url: URL, body: any): Promise<Response> {
  const { db } = resolveDb(env);
  if (!db) return noBinding();

  try {
    await ensurePois(db);

    if (rest[0] === "near") {
      const lat = Number(url.searchParams.get("lat"));
      const lon = Number(url.searchParams.get("lon"));
      const radius = Number(url.searchParams.get("radius") || 5);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return json({ error: "Server Error", details: "lat and lon query params are required", help: HELP }, 400);
      }
      const { results } = await db.prepare(`SELECT * FROM pois WHERE lat IS NOT NULL AND lon IS NOT NULL`).all<any>();
      const near = (results ?? [])
        .map((r) => ({ ...shape(r), distance_km: Number(haversineKm(lat, lon, r.lat, r.lon).toFixed(3)) }))
        .filter((r) => r.distance_km <= radius)
        .sort((a, b) => a.distance_km - b.distance_km);
      return json({ count: near.length, radius_km: radius, results: near });
    }

    if (request.method === "POST") {
      const name = String(body?.name ?? "").trim();
      const lat = Number(body?.latitude ?? body?.lat);
      const lon = Number(body?.longitude ?? body?.lon);
      const missing = [
        !name && "name",
        !Number.isFinite(lat) && "latitude",
        !Number.isFinite(lon) && "longitude",
      ].filter(Boolean);
      if (missing.length) {
        return json({ error: "Server Error", details: `Missing required field(s): ${missing.join(", ")}`, help: HELP }, 400);
      }
      const id = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO pois (id, name, address, category, lat, lon, city, country, source)
           VALUES (?,?,?,?,?,?,?,?,'user')`,
        )
        .bind(id, name, body?.description ?? null, body?.category ?? null, lat, lon, body?.city ?? null, body?.country ?? null)
        .run();
      const row = await db.prepare(`SELECT * FROM pois WHERE id = ?`).bind(id).first<any>();
      return json({ data: shape(row) }, 201);
    }

    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
    const { results } = q
      ? await db
          .prepare(`SELECT * FROM pois WHERE name LIKE ? OR address LIKE ? ORDER BY created_at DESC LIMIT ?`)
          .bind(`%${q}%`, `%${q}%`, limit)
          .all<any>()
      : await db.prepare(`SELECT * FROM pois ORDER BY created_at DESC LIMIT ?`).bind(limit).all<any>();

    const rows = (results ?? []).map(shape);
    return json({ query: q, count: rows.length, results: rows });
  } catch (e) {
    return fail((e as Error).message);
  }
}

/* -------------------------------- tickets -------------------------------- */

export async function ticketsRoute(
  rest: string[],
  request: Request,
  env: AnyEnv,
  url: URL,
  body: any,
  actor: { userId: string | null; isAdmin: boolean; email?: string | null },
): Promise<Response> {
  const { db } = resolveDb(env);
  if (!db) return noBinding();

  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS support_tickets (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           email TEXT,
           subject TEXT,
           message TEXT,
           status TEXT DEFAULT 'open',
           reply TEXT,
           created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
           updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
         )`,
      )
      .run();
    // Older databases may predate these columns.
    for (const col of ["subject TEXT", "reply TEXT", "updated_at DATETIME"]) {
      await db.prepare(`ALTER TABLE support_tickets ADD COLUMN ${col}`).run().catch(() => {});
    }

    const id = rest[0];

    if (request.method === "POST" && !id) {
      const email = String(body?.email ?? actor.email ?? "").trim();
      const message = String(body?.message ?? "").trim();
      if (!email || !message) {
        return json({ error: "Server Error", details: "email and message are required", help: HELP }, 400);
      }
      const res = await db
        .prepare(`INSERT INTO support_tickets (email, subject, message, status) VALUES (?,?,?,'open')`)
        .bind(email, String(body?.subject ?? "Support request").slice(0, 200), message.slice(0, 4000))
        .run();
      return json({ data: { id: res.meta?.last_row_id ?? null, status: "open" } }, 201);
    }

    if (request.method === "PATCH" && id) {
      if (!actor.isAdmin) return json({ error: "Server Error", details: "Admin access required", help: HELP }, 403);
      await db
        .prepare(`UPDATE support_tickets SET status = COALESCE(?, status), reply = COALESCE(?, reply), updated_at = ? WHERE id = ?`)
        .bind(body?.status ?? null, body?.reply ?? null, new Date().toISOString(), id)
        .run();
      const row = await db.prepare(`SELECT * FROM support_tickets WHERE id = ?`).bind(id).first();
      return json({ data: row });
    }

    // GET
    const email = url.searchParams.get("email");
    if (actor.isAdmin && !email) {
      const status = url.searchParams.get("status");
      const { results } = status
        ? await db.prepare(`SELECT * FROM support_tickets WHERE status = ? ORDER BY created_at DESC LIMIT 200`).bind(status).all()
        : await db.prepare(`SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 200`).all();
      return json({ data: results ?? [], scope: "all" });
    }
    if (!email) return json({ data: [], scope: "none", details: "Pass ?email= to list your tickets" });
    const { results } = await db
      .prepare(`SELECT * FROM support_tickets WHERE email = ? ORDER BY created_at DESC LIMIT 100`)
      .bind(email)
      .all();
    return json({ data: results ?? [], scope: "self" });
  } catch (e) {
    return fail((e as Error).message);
  }
}
