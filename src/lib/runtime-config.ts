/**
 * Runtime capability report from the Cloudflare Worker (`GET /api/config`).
 *
 * Lets the UI degrade gracefully instead of crashing when a binding or an
 * environment variable is missing in a given deployment.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export interface RuntimeConfig {
  google: boolean;
  storage: boolean;
  ai: boolean;
  vectorSearch: boolean;
  cache: boolean;
  database: boolean;
}

const FALLBACK: RuntimeConfig = {
  google: false,
  storage: false,
  ai: false,
  vectorSearch: false,
  cache: false,
  database: false,
};

let cached: Promise<RuntimeConfig> | null = null;

export function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!cached) {
    cached = fetch(`${BASE}/api/config`)
      .then((r) => (r.ok ? r.json() : FALLBACK))
      .then((c) => ({ ...FALLBACK, ...c }))
      .catch(() => FALLBACK);
  }
  return cached;
}
