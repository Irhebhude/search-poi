/**
 * Authentication for SEARCH-POI on Cloudflare.
 *
 * Google OAuth 2.0 (authorization-code + PKCE-free state cookie) and
 * email/password with PBKDF2-SHA256. Sessions are opaque random tokens stored
 * in D1 and delivered as HttpOnly, Secure, SameSite=Lax cookies — no JWT in
 * localStorage, no third-party auth SDK.
 *
 * Route layout mirrors Better Auth so the client stays portable:
 *   POST /api/auth/sign-up/email
 *   POST /api/auth/sign-in/email
 *   GET  /api/auth/sign-in/social?provider=google
 *   GET  /api/auth/callback/google
 *   GET  /api/auth/get-session
 *   POST /api/auth/sign-out
 *   POST /api/auth/request-password-reset
 *   POST /api/auth/update-user
 */

export const SESSION_COOKIE = "poi_session";
const STATE_COOKIE = "poi_oauth_state";
const SESSION_DAYS = 30;

export interface Env {
  DB: D1Database;
  CACHE?: KVNamespace;
  BUCKET?: R2Bucket;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AUTH_SECRET?: string;
  ADMIN_EMAILS?: string;
  [key: string]: unknown;
}

/* ------------------------------- primitives ------------------------------- */

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  arr.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function hashPassword(password: string, saltHex?: string): Promise<string> {
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  const hex = (u8: Uint8Array) => Array.from(u8).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$100000$${hex(salt)}$${hex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const candidate = await hashPassword(password, parts[2]);
  // constant-time-ish compare
  const a = enc.encode(candidate);
  const b = enc.encode(stored);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function cookie(name: string, value: string, maxAgeSeconds: number): string {
  const attrs = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  return attrs.join("; ");
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

/* --------------------------------- users ---------------------------------- */

function referralCode(): string {
  return randomToken(6).replace(/[-_]/g, "").slice(0, 8).toUpperCase();
}

export async function createUser(
  env: Env,
  data: { email: string; name?: string | null; image?: string | null; passwordHash?: string | null },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const email = data.email.toLowerCase().trim();
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, image, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, email, data.name ?? email.split("@")[0], data.image ?? null, data.passwordHash ?? null, now, now).run();

  await env.DB.prepare(
    `INSERT INTO profiles (id, display_name, referral_code, email_verified, search_count, is_premium, poi_points, lite_mode, created_at, updated_at)
     VALUES (?, ?, ?, 1, 0, 0, 0, 0, ?, ?)`,
  ).bind(id, data.name ?? email.split("@")[0], referralCode(), now, now).run();

  const admins = (env.ADMIN_EMAILS || "").toLowerCase().split(",").map((e) => e.trim()).filter(Boolean);
  if (admins.includes(email)) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, 'admin', ?)`,
    ).bind(crypto.randomUUID(), id, now).run();
  }

  return getUserById(env, id);
}

export async function getUserByEmail(env: Env, email: string) {
  return env.DB.prepare(`SELECT * FROM users WHERE email = ?`)
    .bind(email.toLowerCase().trim())
    .first<Record<string, any>>();
}

export async function getUserById(env: Env, id: string) {
  return env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<Record<string, any>>();
}

/* -------------------------------- sessions -------------------------------- */

export async function createSession(env: Env, userId: string) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
  ).bind(token, userId, expires, new Date().toISOString()).run();
  return { token, expires };
}

export interface SessionContext {
  userId: string | null;
  isAdmin: boolean;
  user: Record<string, any> | null;
  expiresAt: string | null;
}

export async function getSession(request: Request, env: Env): Promise<SessionContext> {
  const empty: SessionContext = { userId: null, isAdmin: false, user: null, expiresAt: null };
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return empty;

  const row = await env.DB.prepare(
    `SELECT s.expires_at, u.id, u.email, u.name, u.image, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`,
  ).bind(token).first<Record<string, any>>();

  if (!row) return empty;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return empty;
  }

  const admin = await env.DB.prepare(
    `SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin'`,
  ).bind(row.id).first();

  return {
    userId: row.id,
    isAdmin: Boolean(admin),
    expiresAt: row.expires_at,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      image: row.image,
      created_at: row.created_at,
    },
  };
}

export async function destroySession(request: Request, env: Env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
}

/* ------------------------------ google oauth ------------------------------ */

export function googleAuthorizeRedirect(request: Request, env: Env, callbackPath: string) {
  if (!env.GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID is not configured");
  const origin = new URL(request.url).origin;
  const state = `${randomToken(16)}.${btoa(callbackPath || "/")}`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/api/auth/callback/google`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      "Set-Cookie": cookie(STATE_COOKIE, state, 600),
    },
  });
}

export async function googleCallback(request: Request, env: Env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const expected = readCookie(request, STATE_COOKIE);

  if (!code || !state || state !== expected) {
    return Response.redirect(`${url.origin}/auth?error=oauth_state`, 302);
  }

  let callbackPath = "/";
  try {
    callbackPath = atob(state.split(".")[1] || "") || "/";
  } catch { /* default */ }
  if (!callbackPath.startsWith("/")) callbackPath = "/";

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID || "",
      client_secret: env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: `${url.origin}/api/auth/callback/google`,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json<{ access_token?: string; error?: string }>();
  if (!tokens.access_token) {
    return Response.redirect(`${url.origin}/auth?error=oauth_token`, 302);
  }

  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const gp = await profileRes.json<{ sub: string; email: string; name?: string; picture?: string }>();
  if (!gp.email) return Response.redirect(`${url.origin}/auth?error=oauth_profile`, 302);

  let user = await getUserByEmail(env, gp.email);
  if (!user) {
    user = await createUser(env, { email: gp.email, name: gp.name, image: gp.picture });
  }

  await env.DB.prepare(
    `INSERT OR IGNORE INTO accounts (id, user_id, provider, provider_account_id, created_at)
     VALUES (?, ?, 'google', ?, ?)`,
  ).bind(crypto.randomUUID(), user!.id, gp.sub, new Date().toISOString()).run();

  const { token } = await createSession(env, user!.id);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}${callbackPath}`,
      "Set-Cookie": cookie(SESSION_COOKIE, token, SESSION_DAYS * 86400),
    },
  });
}

export { randomToken };
