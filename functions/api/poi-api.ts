const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

  const route = url.pathname.replace(/^\/api/, "") || "/";

  try {
    // --- GET /api/poi-api/ics ---
    if (route === "/poi-api/ics" || route === "/ics") {
      const type = url.searchParams.get("type") || "cash";
      // TODO: replace with your own DB/KV logic
      return json({ type, data: ["Example danger zone", "Example cash point"] });
    }

    // --- POST /api/search ---
    if ((route === "/search" || route === "/poi-api/search") && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const q = (body.query || body.q || "").toString().trim();
      if (!q) return json({ error: "query required" }, 400);
      
      // TODO: replace with Google/Yelp/D1 search
      return json({ 
        success: true, 
        query: q,
        results: [`Result 1 for ${q}`, `Result 2 for ${q}`] 
      });
    }

    // --- GET /api/poi-api/time ---
    if (route === "/poi-api/time" || route === "/time") {
      return json({ time: new Date().toISOString() });
    }

    // --- GET /api/poi-api/gps ---
    if (route === "/poi-api/gps" || route === "/gps") {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      if (!lat || !lon) return json({ error: "lat and lon required" }, 400);
      // TODO: replace with your own GPS logic
      return json({ lat, lon, nearby: ["POI 1", "POI 2"] });
    }

    // --- POST /api/poi-api - your main AI endpoint ---
    if ((route === "/poi-api" || route === "/") && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { query, mode = "default" } = body;
      if (!query) return json({ error: "query required" }, 400);

      return json({
        "success": true,
        "data": {
          "answer": `Cloudflare AI: ${query}`,
          "key_insights": [`Insight for ${query}`],
          "recommendations": ["Action 1"],
          "mode": mode
        },
        "meta": { "powered_by": "SEARCH-POI Engine v1 - Cloudflare" }
      });
    }

    return json({ error: "Not found", route }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
