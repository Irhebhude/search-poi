/**
 * SEARCH-POI Engine v1 — JavaScript SDK (browser + Node 18+, zero deps).
 *
 *   import { SearchPOI } from "./searchpoi.js";
 *   const poi = new SearchPOI({ apiKey: "sk_live_..." });
 *   const { results } = await poi.semanticSearch("jollof rice in Ikeja");
 */

const DEFAULT_BASE = "https://search-poi.pages.dev";

export class SearchPOI {
  constructor({ apiKey, baseUrl = DEFAULT_BASE, fetchImpl = globalThis.fetch } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetch = fetchImpl;
  }

  async #call(path, { method = "GET", body, query } = {}) {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const res = await this.fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `SearchPOI request failed (${res.status})`);
    return data;
  }

  /** Runtime capability report for the deployment. */
  config() {
    return this.#call("/api/config");
  }

  /** Keyword / live POI search backed by OpenStreetMap. */
  search(query, limit = 20) {
    return this.#call("/api/search", { query: { q: query, limit } });
  }

  /** Vector search over indexed POIs (Workers AI embeddings + D1). */
  semanticSearch(query, limit = 20) {
    return this.#call("/api/semantic-search", { method: "POST", body: { query, limit } });
  }

  /** Grounded AI answer with citations. */
  ask(query, mode = "default") {
    return this.#call("/api/v1/query", { method: "POST", body: { query, mode } });
  }

  /** Open a support ticket. */
  support(email, message) {
    return this.#call("/api/support/tickets", { method: "POST", body: { email, message } });
  }

  /** Record a page view / behaviour event. */
  track(path, userId) {
    return this.#call("/api/analytics/events", { method: "POST", body: { path, user_id: userId } });
  }
}

export default SearchPOI;
