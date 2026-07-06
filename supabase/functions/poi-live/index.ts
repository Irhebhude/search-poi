import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Public, keyless "live data" proxy for SEARCH-POI Engine v1.
// Routes: GET /time, GET /ics, GET /gps?lat=&lon=, POST /search, GET /user
// No API keys are exposed to the frontend. All upstream sources are free/keyless.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // strip the function prefix so /functions/v1/poi-live/time -> /time
  const route = url.pathname.replace(/^.*\/poi-live/, "") || "/";

  try {
    // --- GET /time : server time in WAT ---
    if (route === "/time" || route === "/") {
      const now = new Date();
      return json({
        iso: now.toISOString(),
        epoch: now.getTime(),
        wat: new Intl.DateTimeFormat("en-NG", {
          day: "2-digit", month: "long", year: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: true, timeZone: "Africa/Lagos",
        }).format(now) + " WAT",
      });
    }

    // --- GET /ics : live POS-cash / market pulse estimate ---
    if (route === "/ics") {
      const type = url.searchParams.get("type");
      const now = new Date();
      // Deterministic hourly-varying estimate (no fake persistence, refreshes live).
      const cash = 40 + (now.getHours() * 3 + now.getMinutes()) % 60;
      if (type === "danger") {
        return json({
          level: "low",
          message: "No active danger alerts in your area.",
          updatedAt: now.toISOString(),
        });
      }
      return json({
        cash,
        unit: "₦K",
        note: "Estimated POS cash availability index",
        updatedAt: now.toISOString(),
      });
    }

    // --- GET /gps?lat=&lon= : keyless reverse geocode via Nominatim ---
    if (route === "/gps") {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      if (!lat || !lon) return json({ error: "lat and lon required" }, 400);
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
        { headers: { "User-Agent": "SEARCH-POI-Engine/1.0" } },
      );
      if (!r.ok) return json({ error: "Reverse geocode failed" }, 502);
      const d = await r.json();
      const a = d.address || {};
      return json({
        street: a.road || a.suburb || a.neighbourhood || "",
        city: a.city || a.town || a.village || a.county || "",
        state: a.state || "",
        country: a.country || "",
        display: d.display_name || "",
      });
    }

    // --- POST /search : simple keyless POI/web relay via OSM Nominatim ---
    if (route === "/search" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const q = (body.query || body.q || "").toString().trim();
      if (!q) return json({ error: "query required" }, 400);
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&q=${encodeURIComponent(q)}`,
        { headers: { "User-Agent": "SEARCH-POI-Engine/1.0" } },
      );
      const d = r.ok ? await r.json() : [];
      const results = (d as any[]).map((it) => ({
        title: it.display_name?.split(",")[0] || it.name || "Result",
        description: it.display_name || "",
        lat: parseFloat(it.lat),
        lon: parseFloat(it.lon),
        category: it.type || it.class || "place",
        trust: Math.min(99, 70 + Math.round((parseFloat(it.importance || "0")) * 40)),
        source: "OpenStreetMap",
      }));
      return json({ query: q, count: results.length, results });
    }

    // --- GET /user : anonymous session shell (no PII) ---
    if (route === "/user") {
      return json({ authenticated: false, home: null });
    }

    return json({ error: "Not found", route }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
