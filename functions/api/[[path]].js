// Cloudflare Pages Function: keyless proxy API for SEARCH-POI Engine v1.
// Routes handled (all keyless, no secrets in frontend):
//   GET  /api/poi-api/ics?type=danger|cash
//   POST /api/search   { query }
// Falls through to the SEARCH-POI upstream edge function for parity.

const UPSTREAM = "https://cthhyjobjxdyknzcieyq.supabase.co/functions/v1/poi-live";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

  // strip leading /api
  const route = url.pathname.replace(/^\/api/, "") || "/";

  try {
    // --- GET /api/poi-api/ics ---
    if (route === "/poi-api/ics" || route === "/ics") {
      const type = url.searchParams.get("type") || "cash";
      const r = await fetch(`${UPSTREAM}/ics?type=${encodeURIComponent(type)}`);
      if (!r.ok) return json({ error: "Data Unavailable — live source not connected." }, 502);
      return json(await r.json());
    }

    // --- POST /api/search ---
    if ((route === "/search" || route === "/poi-api/search") && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const q = (body.query || body.q || "").toString().trim();
      if (!q) return json({ error: "query required" }, 400);
      const r = await fetch(`${UPSTREAM}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!r.ok) return json({ error: "Data Unavailable — live source not connected." }, 502);
      return json(await r.json());
    }

    // --- GET /api/poi-api/time ---
    if (route === "/poi-api/time" || route === "/time") {
      const r = await fetch(`${UPSTREAM}/time`);
      if (!r.ok) return json({ error: "Data Unavailable — live source not connected." }, 502);
      return json(await r.json());
    }

    // --- GET /api/poi-api/gps ---
    if (route === "/poi-api/gps" || route === "/gps") {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      if (!lat || !lon) return json({ error: "lat and lon required" }, 400);
      const r = await fetch(`${UPSTREAM}/gps?lat=${lat}&lon=${lon}`);
      if (!r.ok) return json({ error: "Data Unavailable — live source not connected." }, 502);
      return json(await r.json());
    }

    return json({ error: "Not found", route }, 404);
  } catch (e) {
    return json({ error: "Data Unavailable — live source not connected." }, 500);
  }
}
