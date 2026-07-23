const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
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
      return json({ type, data: ["Example danger zone", "Example cash point"] });
    }

    // --- POST /api/search ---
    if ((route === "/search" || route === "/poi-api/search") && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const q = (body.query || body.q || "").toString().trim();
      if (!q) return json({ error: "query required" }, 400);

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
      if (!lat ||!lon) return json({ error: "lat and lon required" }, 400);
      return json({ lat, lon, nearby: ["POI 1", "POI 2"] });
    }

    // --- POST /api/poi-api - GROQ AI ENDPOINT ---
    if ((route === "/poi-api" || route === "/") && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { query, mode = "default" } = body;
      if (!query) return json({ error: "query required" }, 400);

      const GROQ_KEY = env.GROQ_API_KEY;
      if (!GROQ_KEY) return json({ error: "GROQ_API_KEY not set in Cloudflare env" }, 500);

      const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: `You are SEARCH-POI Engine v1. Mode: ${mode}. Give helpful, structured answers about Lagos/Nigeria businesses and locations.` },
            { role: "user", content: query }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!aiRes.ok) {
        const err = await aiRes.text();
        return json({ error: "AI failed", details: err }, 500);
      }

      const aiData = await aiRes.json();
      const answer = aiData.choices[0].message.content;

      return json({
        "success": true,
        "data": {
          "answer": answer,
          "key_insights": [],
          "recommendations": [],
          "mode": mode
        },
        "meta": { "powered_by": "SEARCH-POI Engine v1 - Cloudflare + Groq Llama3" }
      });
    }

    return json({ error: "Not found", route }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
