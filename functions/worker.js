// worker.js — consolidated Cloudflare Worker for SEARCH-POI ENGINE v1
// Routes: /api/time, /api/gps, /api/search, /api/export
// Bindings: env.CACHE (KV), env.MAPBOX_KEY, env.GOOGLE_API_KEY (secrets)
//
// Deploy:
//   wrangler secret put GOOGLE_API_KEY
//   wrangler secret put MAPBOX_KEY
//   wrangler deploy
//
// NOTE: This file is the standalone Cloudflare artifact used AFTER exporting the
// repo. It mirrors the per-route functions in /functions/api/*. Keeping both lets
// the app run on Lovable today and deploy to Cloudflare Pages/Workers on export.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: { ...cors, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" },
      });
    }

    try {
      // --- Live server time (drift-sync) ---
      if (url.pathname === "/api/time") {
        const now = new Date();
        return new Response(
          JSON.stringify({
            iso: now.toISOString(),
            epochMs: now.getTime(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
          { headers: { ...cors, "Cache-Control": "no-store" } },
        );
      }

      // --- Reverse geocode (Mapbox) with 24h KV cache ---
      if (url.pathname === "/api/gps") {
        const { lat, lng } = await request.json();
        if (lat == null || lng == null) {
          return new Response(JSON.stringify({ error: "lat and lng required" }), { status: 400, headers: cors });
        }
        const cacheKey = `gps_${lat}_${lng}`;
        let data = env.CACHE ? await env.CACHE.get(cacheKey) : null;
        if (!data) {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${env.MAPBOX_KEY}`,
          );
          data = await res.text();
          if (env.CACHE) ctx.waitUntil(env.CACHE.put(cacheKey, data, { expirationTtl: 86400 }));
        }
        return new Response(data, { headers: cors });
      }

      // --- POI search (Google Places) with 24h KV cache ---
      if (url.pathname === "/api/search") {
        const { query, lat, lng } = await request.json();
        if (!query || String(query).trim().length < 2) {
          return new Response(JSON.stringify({ error: "Query too short" }), { status: 400, headers: cors });
        }
        const cacheKey = `search_${query}_${lat}_${lng}`;
        let data = env.CACHE ? await env.CACHE.get(cacheKey) : null;
        if (!data) {
          const loc = lat != null && lng != null ? `&location=${lat},${lng}&radius=50000` : "";
          const googleRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}${loc}&key=${env.GOOGLE_API_KEY}`,
          );
          const googleData = await googleRes.json();
          const results = googleData.results || [];
          data = JSON.stringify(results.length > 0 ? results : { error: "No data found" });
          if (env.CACHE) ctx.waitUntil(env.CACHE.put(cacheKey, data, { expirationTtl: 86400 }));
        }
        return new Response(data, { headers: cors });
      }

      // --- JSON rows -> CSV download ---
      if (url.pathname === "/api/export") {
        const json = await request.json();
        const rows = Array.isArray(json) ? json : json.rows || [];
        const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const headers = rows.length ? Object.keys(rows[0]) : [];
        const csv = [
          headers.join(","),
          ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
        ].join("\n");
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="search-poi-export.csv"',
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      return new Response(JSON.stringify({ error: "Route not found" }), { status: 404, headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: cors });
    }
  },
};
