/**
 * Behaviour tracking, AI ranking signals, reporting and predictive analytics.
 *
 * Everything aggregates from `user_events`, which the browser writes through
 * POST /api/events (batched, cookie-authenticated, no third-party tracker).
 */

import type { Env } from "./auth";
import { requirePermission } from "./tenancy";
import { clientMeta, forbidden, json, notFound, nowIso, uid, unauthorized } from "./util";

type User = { id: string; email: string } | null | undefined;

const normQuery = (q: string) => q.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);

/* ----------------------------- event ingestion ---------------------------- */

export interface TrackedEvent {
  session_id: string;
  event_type: string;
  query?: string;
  target_url?: string;
  position?: number;
  dwell_ms?: number;
  path?: string;
  referrer?: string;
  viewport_w?: number;
  viewport_h?: number;
  x?: number;
  y?: number;
  metadata?: Record<string, unknown>;
}

export async function trackEvents(env: Env, request: Request, user: User, events: TrackedEvent[], orgId?: string | null) {
  const meta = clientMeta(request);
  const ts = nowIso();
  const rows = events.slice(0, 100).filter((e) => e?.session_id && e?.event_type);
  if (!rows.length) return { accepted: 0 };

  await env.DB.batch(
    rows.map((e) =>
      env.DB.prepare(
        `INSERT INTO user_events (id, session_id, user_id, org_id, event_type, query, target_url, position, dwell_ms,
           path, referrer, device, browser, os, country, city, viewport_w, viewport_h, x, y, metadata, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(
        uid(), e.session_id, user?.id ?? null, orgId ?? null, e.event_type, e.query ?? null, e.target_url ?? null,
        e.position ?? null, e.dwell_ms ?? null, e.path ?? null, e.referrer ?? null, meta.device, meta.browser,
        meta.os, meta.country, meta.city, e.viewport_w ?? null, e.viewport_h ?? null, e.x ?? null, e.y ?? null,
        JSON.stringify(e.metadata ?? {}), ts,
      ),
    ),
  );

  // Feed the ranking model: impressions, clicks and dwell per (query, url).
  const signals = rows.filter((e) => e.query && e.target_url && ["search_impression", "click", "dwell"].includes(e.event_type));
  if (signals.length) {
    await env.DB.batch(
      signals.map((e) =>
        env.DB.prepare(
          `INSERT INTO ranking_signals (id, query_norm, target_url, impressions, clicks, dwell_total_ms, last_seen)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(query_norm, target_url) DO UPDATE SET
             impressions = impressions + excluded.impressions,
             clicks = clicks + excluded.clicks,
             dwell_total_ms = dwell_total_ms + excluded.dwell_total_ms,
             last_seen = excluded.last_seen`,
        ).bind(
          uid(), normQuery(e.query!), e.target_url!,
          e.event_type === "search_impression" ? 1 : 0,
          e.event_type === "click" ? 1 : 0,
          e.event_type === "dwell" ? Math.max(0, Math.min(e.dwell_ms ?? 0, 600000)) : 0,
          ts,
        ),
      ),
    );
  }
  return { accepted: rows.length };
}

/**
 * Learned re-ranking boost for a result URL on a given query.
 * Returns a multiplier in [0.85, 1.35] derived from CTR and mean dwell.
 */
export async function rankingBoost(env: Env, query: string, urls: string[]): Promise<Record<string, number>> {
  if (!urls.length) return {};
  const placeholders = urls.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT target_url, impressions, clicks, dwell_total_ms FROM ranking_signals
      WHERE query_norm = ? AND target_url IN (${placeholders})`,
  ).bind(normQuery(query), ...urls).all<{ target_url: string; impressions: number; clicks: number; dwell_total_ms: number }>();

  const out: Record<string, number> = {};
  for (const r of results ?? []) {
    const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
    const meanDwell = r.clicks > 0 ? r.dwell_total_ms / r.clicks : 0;
    const confidence = Math.min(1, r.impressions / 20);
    const raw = 1 + confidence * (ctr * 0.5 + Math.min(meanDwell / 60000, 1) * 0.2 - (r.impressions >= 10 && ctr < 0.02 ? 0.15 : 0));
    out[r.target_url] = Math.max(0.85, Math.min(1.35, Number(raw.toFixed(3))));
  }
  return out;
}

/* --------------------------------- reports -------------------------------- */

const RANGE_SQL = (from?: string, to?: string) => ({
  where: "created_at >= ? AND created_at <= ?",
  binds: [from ?? new Date(Date.now() - 30 * 864e5).toISOString(), to ?? nowIso()],
});

export async function buildReport(
  env: Env,
  type: string,
  opts: { orgId?: string | null; from?: string; to?: string },
) {
  const { where, binds } = RANGE_SQL(opts.from, opts.to);
  const orgFilter = opts.orgId ? " AND org_id = ?" : "";
  const orgBind = opts.orgId ? [opts.orgId] : [];

  if (type === "search") {
    const { results: top } = await env.DB.prepare(
      `SELECT query, COUNT(*) AS searches FROM user_events
        WHERE event_type = 'search' AND query IS NOT NULL AND ${where}${orgFilter}
        GROUP BY query ORDER BY searches DESC LIMIT 50`,
    ).bind(...binds, ...orgBind).all();
    const { results: daily } = await env.DB.prepare(
      `SELECT substr(created_at,1,10) AS date, COUNT(*) AS searches,
              SUM(CASE WHEN event_type='click' THEN 1 ELSE 0 END) AS clicks
         FROM user_events WHERE ${where}${orgFilter} GROUP BY date ORDER BY date`,
    ).bind(...binds, ...orgBind).all();
    const zero = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM user_events WHERE event_type = 'zero_results' AND ${where}${orgFilter}`,
    ).bind(...binds, ...orgBind).first<{ n: number }>();
    return { type, top_queries: top ?? [], daily: daily ?? [], zero_result_searches: zero?.n ?? 0 };
  }

  if (type === "user") {
    const { results: daily } = await env.DB.prepare(
      `SELECT substr(created_at,1,10) AS date, COUNT(DISTINCT session_id) AS sessions,
              COUNT(DISTINCT user_id) AS users
         FROM user_events WHERE ${where}${orgFilter} GROUP BY date ORDER BY date`,
    ).bind(...binds, ...orgBind).all();
    const { results: devices } = await env.DB.prepare(
      `SELECT device, COUNT(*) AS n FROM user_events WHERE ${where}${orgFilter} GROUP BY device`,
    ).bind(...binds, ...orgBind).all();
    const { results: geo } = await env.DB.prepare(
      `SELECT country, city, COUNT(*) AS n FROM user_events WHERE ${where}${orgFilter} GROUP BY country, city ORDER BY n DESC LIMIT 25`,
    ).bind(...binds, ...orgBind).all();
    return { type, daily: daily ?? [], devices: devices ?? [], geography: geo ?? [] };
  }

  if (type === "performance") {
    const { results } = await env.DB.prepare(
      `SELECT substr(created_at,1,10) AS date,
              COUNT(*) AS events,
              AVG(CASE WHEN dwell_ms IS NOT NULL THEN dwell_ms END) AS avg_dwell_ms
         FROM user_events WHERE ${where}${orgFilter} GROUP BY date ORDER BY date`,
    ).bind(...binds, ...orgBind).all();
    return { type, daily: results ?? [] };
  }

  if (type === "usage") {
    const { results } = await env.DB.prepare(
      `SELECT metric, used, quota FROM org_quotas WHERE org_id = ?`,
    ).bind(opts.orgId ?? "").all();
    return { type, metrics: results ?? [] };
  }

  if (type === "funnel") {
    const steps = ["view", "search", "click", "convert"];
    const counts: Record<string, number> = {};
    for (const s of steps) {
      const row = await env.DB.prepare(
        `SELECT COUNT(DISTINCT session_id) AS n FROM user_events WHERE event_type = ? AND ${where}${orgFilter}`,
      ).bind(s, ...binds, ...orgBind).first<{ n: number }>();
      counts[s] = row?.n ?? 0;
    }
    const entry = counts[steps[0]] || 1;
    return {
      type,
      steps: steps.map((s) => ({ step: s, sessions: counts[s], conversion: Number(((counts[s] / entry) * 100).toFixed(1)) })),
    };
  }

  throw notFound(`Unknown report type: ${type}`);
}

/* ---------------------------- predictive layer ---------------------------- */

export interface ForecastPoint {
  date: string;
  value: number;
  lower: number;
  upper: number;
}

/** Holt's linear trend with weekly seasonality — pure maths, no external model. */
export function forecast(series: Array<{ date: string; value: number }>, horizon = 14): ForecastPoint[] {
  if (series.length < 4) return [];
  const values = series.map((s) => s.value);
  const alpha = 0.5;
  const beta = 0.25;
  let level = values[0];
  let trend = values[1] - values[0];
  const residuals: number[] = [];

  for (let i = 1; i < values.length; i++) {
    const predicted = level + trend;
    residuals.push(values[i] - predicted);
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  // Weekly seasonal index from the residual pattern.
  const seasonal = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  series.forEach((s, i) => {
    if (i === 0) return;
    const dow = new Date(s.date).getUTCDay();
    seasonal[dow] += residuals[i - 1] ?? 0;
    counts[dow]++;
  });
  for (let i = 0; i < 7; i++) seasonal[i] = counts[i] ? seasonal[i] / counts[i] : 0;

  const variance = residuals.reduce((a, r) => a + r * r, 0) / Math.max(1, residuals.length);
  const sd = Math.sqrt(variance);
  const last = new Date(series[series.length - 1].date);

  const out: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const d = new Date(last.getTime() + h * 864e5);
    const base = level + trend * h + seasonal[d.getUTCDay()];
    const value = Math.max(0, base);
    const band = 1.96 * sd * Math.sqrt(h);
    out.push({
      date: d.toISOString().slice(0, 10),
      value: Number(value.toFixed(2)),
      lower: Number(Math.max(0, value - band).toFixed(2)),
      upper: Number((value + band).toFixed(2)),
    });
  }
  return out;
}

/** Flags days whose value deviates more than 3 sigma from the rolling mean. */
export function detectAnomalies(series: Array<{ date: string; value: number }>, window = 7) {
  const out: Array<{ date: string; value: number; expected: number; z: number }> = [];
  for (let i = window; i < series.length; i++) {
    const slice = series.slice(i - window, i).map((s) => s.value);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length) || 1;
    const z = (series[i].value - mean) / sd;
    if (Math.abs(z) >= 3) out.push({ date: series[i].date, value: series[i].value, expected: Number(mean.toFixed(2)), z: Number(z.toFixed(2)) });
  }
  return out;
}

async function dailySeries(env: Env, metric: string, orgId?: string | null, days = 60) {
  const from = new Date(Date.now() - days * 864e5).toISOString();
  const orgFilter = orgId ? " AND org_id = ?" : "";
  const binds: unknown[] = [from];
  if (orgId) binds.push(orgId);
  const eventType = metric === "searches" ? "search" : metric === "clicks" ? "click" : null;
  const typeFilter = eventType ? " AND event_type = ?" : "";
  if (eventType) binds.push(eventType);
  const { results } = await env.DB.prepare(
    `SELECT substr(created_at,1,10) AS date, COUNT(*) AS value
       FROM user_events WHERE created_at >= ?${orgFilter}${typeFilter}
      GROUP BY date ORDER BY date`,
  ).bind(...binds).all<{ date: string; value: number }>();
  return results ?? [];
}

/* --------------------------------- routing -------------------------------- */

export async function handleAnalyticsRoute(
  segments: string[],
  request: Request,
  env: Env,
  body: any,
  session: { user?: User },
): Promise<Response> {
  const [first] = segments;
  const url = new URL(request.url);
  const user = session.user;
  const orgId = url.searchParams.get("org_id") || body?.org_id || null;

  if (first === "events" && request.method === "POST") {
    const events: TrackedEvent[] = Array.isArray(body?.events) ? body.events : body ? [body] : [];
    return json({ data: await trackEvents(env, request, user, events, orgId) }, 202);
  }

  if (first === "ranking-boost" && request.method === "POST") {
    return json({ data: await rankingBoost(env, String(body?.query ?? ""), body?.urls ?? []) });
  }

  if (!user) throw unauthorized();
  if (orgId) await requirePermission(env, orgId, user.id, "reports:read");

  if (first === "report" && (request.method === "GET" || request.method === "POST")) {
    const type = url.searchParams.get("type") || body?.type || "search";
    const data = await buildReport(env, type, { orgId, from: url.searchParams.get("from") || body?.from, to: url.searchParams.get("to") || body?.to });
    await env.DB.prepare(
      `INSERT INTO report_runs (id, org_id, type, range_from, range_to, rows, payload, created_at) VALUES (?,?,?,?,?,?,?,?)`,
    ).bind(uid(), orgId, type, body?.from ?? null, body?.to ?? null, 0, JSON.stringify(data).slice(0, 100000), nowIso()).run();
    return json({ data });
  }

  if (first === "forecast") {
    const metric = url.searchParams.get("metric") || body?.metric || "searches";
    const horizon = Number(url.searchParams.get("horizon") || body?.horizon || 14);
    const series = await dailySeries(env, metric, orgId);
    const points = forecast(series, horizon);
    const anomalies = detectAnomalies(series);
    if (points.length) {
      await env.DB.prepare(
        `INSERT INTO forecasts (id, org_id, metric, horizon_days, points, method, created_at) VALUES (?,?,?,?,?,'holt-linear',?)`,
      ).bind(uid(), orgId, metric, horizon, JSON.stringify(points), nowIso()).run();
    }
    return json({ data: { metric, history: series, forecast: points, anomalies } });
  }

  if (first === "heatmap") {
    const path = url.searchParams.get("path") || "/";
    const { results } = await env.DB.prepare(
      `SELECT x, y, viewport_w, viewport_h, COUNT(*) AS weight FROM user_events
        WHERE event_type = 'click' AND path = ? AND x IS NOT NULL
        GROUP BY x/20, y/20 ORDER BY weight DESC LIMIT 500`,
    ).bind(path).all();
    return json({ data: results ?? [] });
  }

  if (first === "journeys") {
    const { results } = await env.DB.prepare(
      `SELECT session_id, GROUP_CONCAT(event_type, ' > ') AS journey, COUNT(*) AS steps, MIN(created_at) AS started
         FROM (SELECT * FROM user_events ORDER BY created_at LIMIT 5000)
        GROUP BY session_id ORDER BY started DESC LIMIT 50`,
    ).all();
    return json({ data: results ?? [] });
  }

  throw notFound();
}
