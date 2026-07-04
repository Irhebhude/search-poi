// worker.js — SEARCH-POI ENGINE v1 - 100% FREE OSM VERSION
// Routes: /api/time, /api/gps, /api/search, /api/export
// Bindings: env.CACHE (KV only)
// Deploy: wrangler deploy
// NOTE: NO API KEYS NEEDED. Uses OpenStreetMap Nominatim + Overpass

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {...cors, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" },
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
          { headers: {...cors, "Cache-Control": "no-store" } },
        );
      }

      // --- Reverse geocode FREE - Nominatim OSM with 24h KV cache ---
      if (url.pathname === "/api/gps") {
        const { lat, lng } = await request.json();
        if (lat == null || lng == null) {
          return new Response(JSON.stringify({ error: "lat and lng required" }), { status: 400, headers: cors });
        }
        const cacheKey = `nominatim_${lat}_${lng}`;
        let data = env.CACHE? await env.CACHE.get(cacheKey) : null;
        if (!data) {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
            { headers: { "User-Agent": "Search-POI-Engine-v1" } }
          );
          data = await res.text();
          if (env.CACHE) ctx.waitUntil(env.CACHE.put(cacheKey, data, { expirationTtl: 86400 }));
        }
        return new Response(data, { headers: cors });
      }

      // --- POI search FREE - Overpass OSM with 24h KV cache ---
      if (url.pathname === "/api/search") {
        const { query, lat, lng } = await request.json();
        if (!query || String(query).trim().length < 2) {
          return new Response(JSON.stringify({ error: "Query too short" }), { status: 400, headers: cors });
        }
        const cacheKey = `osm_${query}_${lat}_${lng}`;
        let data = env.CACHE? await env.CACHE.get(cacheKey) : null;
        if (!data) {
          // Search for amenity that matches query near lat,lng within 50km
          const overpassQuery = `
            [out:json][timeout:25];
            (
              node["amenity"~"${query}",i](around:50000,${lat},${lng});
              way["amenity"~"${query}",i](around:50000,${lat},${lng});
              node["shop"~"${query}",i](around:50000,${lat},${lng});
              way["shop"~"${query}",i](around:50000,${lat},${lng});
            );
            out center 100;
          `;
          const osmRes = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: overpassQuery,
            headers: { "User-Agent": "Search-POI-Engine-v1" }
          });
          const osmData = await osmRes.json();
          const results = osmData.elements || [];
          data = JSON.stringify(results.length > 0? results : { error: "No data found" });
          if (env.CACHE) ctx.waitUntil(env.CACHE.put(cacheKey, data, { expirationTtl: 86400 }));
        }
        return new Response(data, { headers: cors });
      }

      // --- JSON rows -> CSV download ---
      if (url.pathname === "/api/export") {
        const json = await request.json();
        const rows = Array.isArray(json)? json : json.rows || [];
        const esc = (v) => `"${String(v?? "").replace(/"/g, '""')}"`;
        const headers = rows.length? Object.keys(rows[0]) : [];
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
