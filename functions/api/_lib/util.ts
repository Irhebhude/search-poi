/** Shared helpers for the enterprise API modules. */
import type { Env } from "./auth";

export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
export const period = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const bad = (m: string) => new HttpError(400, m);
export const unauthorized = (m = "Authentication required") => new HttpError(401, m);
export const forbidden = (m = "Forbidden") => new HttpError(403, m);
export const notFound = (m = "Not found") => new HttpError(404, m);

export function clientMeta(request: Request) {
  const ua = request.headers.get("User-Agent") || "";
  const cf = (request as any).cf || {};
  const device = /Mobi|Android|iPhone/i.test(ua) ? "mobile" : /iPad|Tablet/i.test(ua) ? "tablet" : "desktop";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox" : "Other";
  const os = /Windows/.test(ua) ? "Windows"
    : /Mac OS/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux" : "Other";
  return {
    ua,
    device,
    browser,
    os,
    ip: request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || null,
    country: cf.country ?? null,
    city: cf.city ?? null,
  };
}

/** Append-only audit trail. Never throws — auditing must not break a request. */
export async function audit(
  env: Env,
  entry: {
    orgId?: string | null;
    actorId?: string | null;
    actorEmail?: string | null;
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    request?: Request;
  },
) {
  try {
    const meta = entry.request ? clientMeta(entry.request) : null;
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, org_id, actor_id, actor_email, action, resource_type, resource_id, metadata, ip, user_agent, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        uid(), entry.orgId ?? null, entry.actorId ?? null, entry.actorEmail ?? null, entry.action,
        entry.resourceType ?? null, entry.resourceId ?? null, JSON.stringify(entry.metadata ?? {}),
        meta?.ip ?? null, meta?.ua ?? null, nowIso(),
      )
      .run();
  } catch {
    /* audit failures are swallowed by design */
  }
}

/** Sliding-window rate limiter backed by KV when present, D1 otherwise. */
export async function rateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const reset = (bucket + 1) * windowSeconds;
  const id = `rl:${key}:${bucket}`;

  if (env.CACHE) {
    const current = Number((await env.CACHE.get(id)) || 0) + 1;
    await env.CACHE.put(id, String(current), { expirationTtl: windowSeconds + 60 });
    return { allowed: current <= limit, remaining: Math.max(0, limit - current), reset };
  }

  await env.DB.prepare(
    `INSERT INTO rate_limit_buckets (id, hits, window_start) VALUES (?,1,?)
     ON CONFLICT(id) DO UPDATE SET hits = hits + 1`,
  ).bind(id, nowIso()).run();
  const row = await env.DB.prepare(`SELECT hits FROM rate_limit_buckets WHERE id = ?`).bind(id).first<{ hits: number }>();
  const hits = row?.hits ?? 1;
  return { allowed: hits <= limit, remaining: Math.max(0, limit - hits), reset };
}

/** Simple deterministic slug. */
export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled";

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
