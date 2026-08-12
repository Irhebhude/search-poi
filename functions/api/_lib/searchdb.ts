/**
 * Fact-based search layer — keyword search over the `documents` table in D1.
 *
 * No AI, no embeddings, no generation: every row returned here came out of the
 * database exactly as it was indexed.
 */

import { json } from "./util";
import { resolveDb, type AnyEnv } from "./poi";

export const FREE_MONTHLY_QUOTA = 1000;

const nowIso = () => new Date().toISOString();
const currentPeriod = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Create the documents + api_keys tables, then backfill POIs once. */
export async function ensureSearchSchema(db: D1Database): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS documents (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       title TEXT NOT NULL,
       url TEXT NOT NULL,
       content TEXT NOT NULL,
       source TEXT DEFAULT 'web',
       price REAL DEFAULT NULL,
       location TEXT DEFAULT NULL,
       updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS search_api_keys (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       key TEXT UNIQUE NOT NULL,
       owner_email TEXT NOT NULL,
       owner_name TEXT,
       requests_count INTEGER DEFAULT 0,
       period TEXT,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       is_active INTEGER DEFAULT 1
     )`,
  ).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title)`).run().catch(() => {});

  // One-time migration of existing POIs into the document index.
  const existing = await db.prepare(`SELECT COUNT(*) AS n FROM documents WHERE source = 'poi'`)
    .first<{ n: number }>().catch(() => ({ n: 1 }));
  if ((existing?.n ?? 0) > 0) return;

  const pois = await db
    .prepare(`SELECT name, address, city, country, website, lat, lon FROM pois LIMIT 5000`)
    .all<any>()
    .catch(() => ({ results: [] as any[] }));

  const rows = pois.results ?? [];
  if (!rows.length) return;

  const stmt = db.prepare(
    `INSERT INTO documents (title, url, content, source, location, updated_at) VALUES (?,?,?,'poi',?,?)`,
  );
  await db.batch(
    rows.map((r) =>
      stmt.bind(
        r.name ?? "Untitled POI",
        r.website || `https://www.openstreetmap.org/?mlat=${r.lat ?? 0}&mlon=${r.lon ?? 0}`,
        [r.name, r.address, r.city, r.country].filter(Boolean).join(" · "),
        [r.city, r.country].filter(Boolean).join(", ") || null,
        nowIso(),
      ),
    ),
  );
}

/* ------------------------------- API keys -------------------------------- */

export const newApiKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return "SEARCHPOI_" + Array.from(bytes, (b) => chars[b % chars.length]).join("").slice(0, 32);
};

function extractKey(request: Request, url: URL): string | null {
  const auth = request.headers.get("Authorization") || "";
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1];
  return (bearer || request.headers.get("x-api-key") || url.searchParams.get("api_key") || "").trim() || null;
}

interface KeyRow { id: number; key: string; owner_email: string; requests_count: number; period: string | null; is_active: number }

/** Validate the caller's key and charge one request against their quota. */
async function authorize(db: D1Database, request: Request, url: URL): Promise<{ row?: KeyRow; error?: Response }> {
  const key = extractKey(request, url);
  if (!key) return { error: json({ error: "Invalid or missing API key" }, 401) };

  const row = await db.prepare(`SELECT * FROM search_api_keys WHERE key = ? AND is_active = 1`)
    .bind(key).first<KeyRow>();
  if (!row) return { error: json({ error: "Invalid or missing API key" }, 401) };

  const period = currentPeriod();
  const count = row.period === period ? row.requests_count : 0;
  if (count >= FREE_MONTHLY_QUOTA) {
    return { error: json({ error: "Monthly quota exceeded", limit: FREE_MONTHLY_QUOTA, period }, 429) };
  }
  await db.prepare(`UPDATE search_api_keys SET requests_count = ?, period = ? WHERE id = ?`)
    .bind(count + 1, period, row.id).run();

  return { row };
}

/* -------------------------------- search --------------------------------- */

const PRICE_HINTS = /price|cost|fuel|pos|rate|₦|naira/i;

export async function factSearchRoute(request: Request, env: AnyEnv, url: URL): Promise<Response> {
  const started = Date.now();
  const { db } = resolveDb(env);
  if (!db) return json({ error: "Database unavailable" }, 503);

  await ensureSearchSchema(db);
  const auth = await authorize(db, request, url);
  if (auth.error) return auth.error;

  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ error: "Query parameter q is required" }, 400);

  const like = `%${q.replace(/[%_]/g, "")}%`;
  const priceFirst = PRICE_HINTS.test(q);
  const order = priceFirst
    ? `ORDER BY (price IS NULL), updated_at DESC`
    : `ORDER BY updated_at DESC`;

  const { results } = await db
    .prepare(`SELECT id, title, url, content, source, price, location, updated_at
              FROM documents WHERE title LIKE ? OR content LIKE ? ${order} LIMIT 20`)
    .bind(like, like)
    .all<any>();

  const time = `${((Date.now() - started) / 1000).toFixed(3)}s`;
  const rows = results ?? [];

  if (!rows.length) {
    return json({ results: [], count: 0, query: q, time, message: "No results found in database." });
  }

  return json({
    results: rows.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: String(r.content || "").slice(0, 280),
      price: r.price ?? null,
      location: r.location ?? null,
      source: r.source,
      updated_at: r.updated_at,
    })),
    count: rows.length,
    query: q,
    time,
    disclaimer: "Results from SEARCH-POI database only. No AI generation.",
  });
}

/* -------------------------------- indexing -------------------------------- */

export async function indexDocumentRoute(request: Request, env: AnyEnv, url: URL, body: any): Promise<Response> {
  const { db } = resolveDb(env);
  if (!db) return json({ error: "Database unavailable" }, 503);
  await ensureSearchSchema(db);

  const auth = await authorize(db, request, url);
  if (auth.error) return auth.error;

  const title = String(body?.title || "").trim();
  const link = String(body?.url || "").trim();
  const content = String(body?.content || "").trim();
  if (!title || !link || !content) return json({ error: "title, url and content are required" }, 400);

  const res = await db
    .prepare(`INSERT INTO documents (title, url, content, source, price, location, updated_at)
              VALUES (?,?,?,?,?,?,?)`)
    .bind(
      title.slice(0, 300), link.slice(0, 1000), content.slice(0, 20000),
      String(body?.source || "web").slice(0, 50),
      body?.price === undefined || body?.price === null ? null : Number(body.price),
      body?.location ? String(body.location).slice(0, 200) : null,
      nowIso(),
    )
    .run();

  return json({ status: "ok", id: res.meta?.last_row_id ?? null });
}

/* ------------------------------ key management ---------------------------- */

export async function keysRoute(
  rest: string[],
  request: Request,
  env: AnyEnv,
  actor: { email: string | null; name?: string | null },
): Promise<Response> {
  const { db } = resolveDb(env);
  if (!db) return json({ error: "Database unavailable" }, 503);
  await ensureSearchSchema(db);

  if (!actor.email) return json({ error: "Authentication required" }, 401);

  if (request.method === "GET") {
    const { results } = await db
      .prepare(`SELECT id, key, requests_count, period, created_at, is_active
                FROM search_api_keys WHERE owner_email = ? ORDER BY created_at DESC`)
      .bind(actor.email).all<any>();
    return json({ keys: results ?? [], quota: FREE_MONTHLY_QUOTA, period: currentPeriod() });
  }

  if (request.method === "POST" && rest[0] === "generate") {
    await db.prepare(`UPDATE search_api_keys SET is_active = 0 WHERE owner_email = ?`).bind(actor.email).run();
    const key = newApiKey();
    await db
      .prepare(`INSERT INTO search_api_keys (key, owner_email, owner_name, requests_count, period, created_at, is_active)
                VALUES (?,?,?,0,?,?,1)`)
      .bind(key, actor.email, actor.name ?? null, currentPeriod(), nowIso())
      .run();
    return json({ api_key: key, quota: FREE_MONTHLY_QUOTA });
  }

  return json({ error: "Unsupported method" }, 405);
}

/** Total indexed documents, for /api/health. */
export async function documentsCount(db: D1Database): Promise<number> {
  try {
    await ensureSearchSchema(db);
    return (await db.prepare(`SELECT COUNT(*) AS n FROM documents`).first<{ n: number }>())?.n ?? 0;
  } catch {
    return 0;
  }
}
