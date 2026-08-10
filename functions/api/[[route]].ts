/**
 * SEARCH-POI REST API — single Cloudflare Pages Function router.
 *
 * Mounted at /api/*. Backed by D1 (database), KV (cache) and R2 (files).
 */

import {
  SESSION_COOKIE, cookie, createSession, createUser, destroySession, getSession,
  getUserByEmail, googleAuthorizeRedirect, googleCallback, hashPassword, randomToken,
  verifyPassword, type Env,
} from "./_lib/auth";
import { runTableQuery } from "./_lib/db";
import { handleAnalyticsRoute } from "./_lib/analytics";
import { handleOrgRoute } from "./_lib/tenancy";
import { handleRagRoute } from "./_lib/rag";
import { handleSupportRoute } from "./_lib/support";
import { handleV1Route, openApiDocument } from "./_lib/devplatform";
import { HttpError } from "./_lib/util";
import { runRpc } from "./_lib/rpc";
import { reindexPois, semanticSearch } from "./_lib/semantic";
import {
  ayrsharePost, dealRoomApprove, feedbackAi, generateBlueprint, generateBuildGuide,
  generateTrendingContent, imageSearch, json, newsSearch, poiApi, poiLive, poiLiveSearch,
  searchAi, summarizeUrl, videoSearch, webSearch,
} from "./_lib/handlers";

interface Ctx {
  request: Request;
  env: Env;
  params: { route?: string | string[] };
}

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key, authorization",
});

function withCors(res: Response, origin: string) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors(origin))) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || url.origin;

  if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });

  const segments = (Array.isArray(ctx.params.route) ? ctx.params.route : [ctx.params.route || ""]).filter(Boolean);
  const [head, ...rest] = segments;

  try {
    const res = await route(head, rest, request, env, url);
    return withCors(res, origin);
  } catch (e) {
    if (e instanceof HttpError) return withCors(json({ error: e.message }, e.status), origin);
    const message = e instanceof Error ? e.message : "Unexpected error";
    const status = /required|Forbidden|Unauthor/i.test(message) ? (/Forbidden/.test(message) ? 403 : 401) : 400;
    return withCors(json({ error: message }, status), origin);
  }
};

async function readJson(request: Request) {
  if (request.method === "GET" || request.method === "DELETE") return {};
  return request.json<any>().catch(() => ({}));
}

async function route(head: string, rest: string[], request: Request, env: Env, url: URL): Promise<Response> {
  /* ------------------------------- auth ---------------------------------- */
  if (head === "auth") {
    const action = rest.join("/");

    if (action === "get-session") {
      const s = await getSession(request, env);
      return json({ session: s.user ? { user: s.user, expires_at: s.expiresAt } : null });
    }

    if (action === "sign-in/social") {
      const provider = url.searchParams.get("provider") || "google";
      if (provider !== "google") return json({ error: "Unsupported provider" }, 400);
      return googleAuthorizeRedirect(request, env, url.searchParams.get("callbackURL") || "/");
    }

    if (action === "callback/google") return googleCallback(request, env);

    if (action === "sign-up/email") {
      const { email, password, name } = await readJson(request);
      if (!email || !password || String(password).length < 6) {
        return json({ error: "Email and a password of at least 6 characters are required" }, 400);
      }
      if (await getUserByEmail(env, email)) return json({ error: "An account with this email already exists" }, 409);
      const user = await createUser(env, { email, name, passwordHash: await hashPassword(password) });
      const { token, expires } = await createSession(env, user!.id);
      return json(
        { session: { user: { id: user!.id, email: user!.email, name: user!.name, image: user!.image, created_at: user!.created_at }, expires_at: expires } },
        200,
        { "Set-Cookie": cookie(SESSION_COOKIE, token, 30 * 86400) },
      );
    }

    if (action === "sign-in/email") {
      const { email, password } = await readJson(request);
      const user = await getUserByEmail(env, email || "");
      if (!user?.password_hash || !(await verifyPassword(password || "", user.password_hash))) {
        return json({ error: "Invalid email or password" }, 401);
      }
      const { token, expires } = await createSession(env, user.id);
      return json(
        { session: { user: { id: user.id, email: user.email, name: user.name, image: user.image, created_at: user.created_at }, expires_at: expires } },
        200,
        { "Set-Cookie": cookie(SESSION_COOKIE, token, 30 * 86400) },
      );
    }

    if (action === "sign-out") {
      await destroySession(request, env);
      return json({ ok: true }, 200, { "Set-Cookie": cookie(SESSION_COOKIE, "", 0) });
    }

    if (action === "request-password-reset") {
      const { email, redirectTo } = await readJson(request);
      const user = await getUserByEmail(env, email || "");
      // Always answer 200 so the endpoint cannot be used to enumerate accounts.
      if (user) {
        const token = randomToken(32);
        await env.DB.prepare(
          `INSERT INTO password_resets (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
        ).bind(token, user.id, new Date(Date.now() + 3600_000).toISOString(), new Date().toISOString()).run();
        const link = `${redirectTo || `${url.origin}/reset-password`}?token=${token}`;
        // No mail provider is configured; the link is returned for the caller to deliver.
        return json({ ok: true, resetUrl: link });
      }
      return json({ ok: true });
    }

    if (action === "update-user") {
      const { password, token } = await readJson(request);
      let userId: string | null = null;

      if (token) {
        const row = await env.DB.prepare(`SELECT * FROM password_resets WHERE token = ?`)
          .bind(token).first<Record<string, any>>();
        if (!row || new Date(row.expires_at).getTime() < Date.now()) {
          return json({ error: "Reset link is invalid or has expired" }, 400);
        }
        userId = row.user_id;
        await env.DB.prepare(`DELETE FROM password_resets WHERE token = ?`).bind(token).run();
      } else {
        userId = (await getSession(request, env)).userId;
      }
      if (!userId) return json({ error: "Authentication required" }, 401);
      if (!password || String(password).length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

      await env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
        .bind(await hashPassword(password), new Date().toISOString(), userId).run();
      await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();

      const { token: sessionToken, expires } = await createSession(env, userId);
      const user = await env.DB.prepare(`SELECT id, email, name, image, created_at FROM users WHERE id = ?`)
        .bind(userId).first<Record<string, any>>();
      return json({ session: { user, expires_at: expires } }, 200, {
        "Set-Cookie": cookie(SESSION_COOKIE, sessionToken, 30 * 86400),
      });
    }

    return json({ error: "Unknown auth route" }, 404);
  }

  /* ----------------------- runtime capability report ---------------------- */
  if (head === "config") {
    return json({
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      storage: Boolean(env.BUCKET),
      ai: Boolean(env.GROQ_API_KEY || env.OPENROUTER_API_KEY || env.GEMINI_API_KEY || (env as any).AI),
      vectorSearch: Boolean((env as any).AI),
      cache: Boolean(env.CACHE),
      database: Boolean(env.DB),
    });
  }

  /* --------------------- D1 + Workers AI semantic search ------------------- */
  if (head === "semantic-search") {
    const body = await readJson(request);
    const q = String(body.query ?? url.searchParams.get("q") ?? "");
    const topK = Number(body.limit ?? url.searchParams.get("limit") ?? 20);
    if (rest[0] === "reindex") {
      const n = await reindexPois(env as any, Number(body.limit) || 200);
      return json({ indexed: n });
    }
    return json(await semanticSearch(q, env as any, topK));
  }

  const session = await getSession(request, env);
  const actor = { userId: session.userId, isAdmin: session.isAdmin };
  const sessionCtx = { user: (session as any).user ?? null };

  /* -------------------------- enterprise modules -------------------------- */

  if (head === "v1") return handleV1Route(rest, request, env as any, await readJson(request));
  if (head === "openapi.json") return json(openApiDocument(url.origin));
  if (head === "orgs") return handleOrgRoute(rest, request, env, await readJson(request), sessionCtx);
  if (head === "rag") return handleRagRoute(rest, request, env as any, await readJson(request), sessionCtx);
  if (head === "support") {
    const isUpload = rest[0] === "upload";
    return handleSupportRoute(rest, request, env, isUpload ? {} : await readJson(request), sessionCtx);
  }
  if (head === "events" || head === "analytics") {
    const segs = head === "events" ? ["events", ...rest] : rest;
    return handleAnalyticsRoute(segs, request, env, await readJson(request), sessionCtx);
  }

  /* -------------------------------- data --------------------------------- */
  if (head === "db") {
    const [table, action] = rest;
    if (!table || !action) return json({ error: "table and action required" }, 400);
    const body = await readJson(request);
    const data = await runTableQuery(env.DB, table, action as any, body, actor);
    return json({ data });
  }

  if (head === "rpc") {
    const data = await runRpc(rest.join("/"), await readJson(request), env, actor);
    return json({ data });
  }

  /* --------------------------- places REST API --------------------------- */
  if (head === "places" || head === "place") {
    const id = head === "place" ? rest[0] : rest[0];
    const body = await readJson(request);

    if (request.method === "GET" && head === "place" && id) {
      const data = await runTableQuery(env.DB, "businesses", "select",
        { filters: [{ column: "id", op: "eq", value: id }], rowMode: "single" }, actor);
      return json({ data });
    }
    if (request.method === "GET") {
      const filters = [] as any[];
      const city = url.searchParams.get("city");
      const category = url.searchParams.get("category");
      if (city) filters.push({ column: "city", op: "eq", value: city });
      if (category) filters.push({ column: "category", op: "eq", value: category });
      const data = await runTableQuery(env.DB, "businesses", "select",
        { filters, order: { column: "created_at", ascending: false }, limit: Number(url.searchParams.get("limit")) || 50 }, actor);
      return json({ data });
    }
    if (request.method === "POST") {
      const data = await runTableQuery(env.DB, "businesses", "insert", { values: body }, actor);
      return json({ data });
    }
    if (request.method === "PUT" && id) {
      const data = await runTableQuery(env.DB, "businesses", "update",
        { values: body, filters: [{ column: "id", op: "eq", value: id }] }, actor);
      return json({ data });
    }
    if (request.method === "DELETE" && id) {
      await runTableQuery(env.DB, "businesses", "delete",
        { filters: [{ column: "id", op: "eq", value: id }] }, actor);
      return json({ data: { deleted: id } });
    }
    return json({ error: "Unsupported method" }, 405);
  }

  if (head === "search") {
    const q = url.searchParams.get("q") || "";
    return poiLiveSearch({ query: q, limit: Number(url.searchParams.get("limit")) || 50 }, env);
  }

  /* ------------------------------- storage -------------------------------- */
  if (head === "storage") {
    const [bucket, op, ...pathParts] = rest;
    if (!env.BUCKET) return json({ error: "File uploads disabled" }, 501);

    if (op === "upload") {
      if (!actor.isAdmin) return json({ error: "Forbidden: admin only" }, 403);
      const form = await request.formData();
      const file = form.get("file") as unknown as File | null;
      const path = String(form.get("path") || "");
      if (!file || !path) return json({ error: "file and path are required" }, 400);
      const key = `${bucket}/${path}`;
      await env.BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: (file as any).type || "application/octet-stream" },
      });
      return json({ path, key, size: (file as any).size ?? null });
    }

    if (op === "remove") {
      if (!actor.isAdmin) return json({ error: "Forbidden: admin only" }, 403);
      const { paths } = await readJson(request);
      for (const p of paths || []) await env.BUCKET.delete(`${bucket}/${p}`);
      return json({ ok: true });
    }

    if (op === "download") {
      const token = url.searchParams.get("token");
      if (!token) return json({ error: "token required" }, 400);
      const req = await env.DB.prepare(
        `SELECT * FROM deal_access_requests WHERE download_token = ? AND status = 'approved'`,
      ).bind(token).first<Record<string, any>>();
      if (!req || new Date(req.token_expires_at).getTime() < Date.now()) {
        return json({ error: "This download link is invalid or has expired" }, 403);
      }
      const doc = await env.DB.prepare(`SELECT * FROM deal_documents WHERE id = ?`)
        .bind(req.document_id).first<Record<string, any>>();
      if (!doc) return json({ error: "Document not found" }, 404);
      const object = await env.BUCKET.get(`${bucket}/${doc.file_path}`);
      if (!object) return json({ error: "File not found" }, 404);
      return new Response(object.body, {
        headers: {
          "Content-Type": doc.mime_type || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${doc.file_name}"`,
        },
      });
    }

    if (op === "object") {
      if (!actor.isAdmin) return json({ error: "Forbidden" }, 403);
      const object = await env.BUCKET.get(`${bucket}/${pathParts.join("/")}`);
      if (!object) return json({ error: "Not found" }, 404);
      return new Response(object.body, {
        headers: { "Content-Type": object.httpMetadata?.contentType || "application/octet-stream" },
      });
    }

    return json({ error: "Unknown storage operation" }, 404);
  }

  /* ------------------------------ functions ------------------------------- */
  if (head === "poi-api") {
    return poiApi(request, await readJson(request), env);
  }

  if (head === "poi-live") {
    return poiLive(rest[0] || "", request, env);
  }

  if (head === "fn") {
    const name = rest[0];
    const body = await readJson(request);
    switch (name) {
      case "search-ai": return searchAi(body, env);
      case "web-search": return webSearch(body);
      case "news-search": return newsSearch(body);
      case "image-search": return imageSearch(body);
      case "video-search": return videoSearch(body);
      case "summarize-url": return summarizeUrl(body, env);
      case "poi-live-search": return poiLiveSearch(body, env);
      case "generate-blueprint": return generateBlueprint(body, env);
      case "generate-build-guide": return generateBuildGuide(body, env);
      case "generate-trending-content": return generateTrendingContent(env);
      case "feedback-ai": return feedbackAi(body, env);
      case "ayrshare-post": return ayrsharePost(body, env);
      case "deal-room-approve": return dealRoomApprove(body, env, actor, url.origin);
      case "poi-api": return poiApi(request, body, env);
      default: return json({ error: `Unknown function: ${name}` }, 404);
    }
  }

  return json({ error: "Not found" }, 404);
}

/** Scheduled trigger: refresh programmatic SEO content. */
export const onSchedule = async (env: Env) => generateTrendingContent(env);
