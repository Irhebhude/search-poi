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
  const { request } = context;
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  const route = url.pathname.replace(/^\/api/, "") || "/";
  try {
    if (route === "/poi-api/ics" || route === "/ics") {
      const type = url.searchParams.get("type") || "cash";
      return json({ type, data: ["Example danger zone", "Example cash point"] });
    }
    if ((route === "/search" || route === "/poi-api/search") && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const q = (body.query || body.q || "").toString().trim();
      if (!q) return json({ error: "query required" }, 400);
      return json({ success: true, query: q, results: [`Result 1 for ${q}`, `Result 2 for ${q}`] });
    }
    if (route === "/poi-api/time" || route === "/time") {
      return json({ time: new Date().toISOString() });
    }
    if (route === "/poi-api/gps" || route === "/gps") {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      if (!lat ||!lon) return json({ error: "lat and lon required" }, 400);
      return json({ lat, lon, nearby: ["POI 1", "POI 2"] });
    }
    if ((route === "/poi-api" || route === "/") && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { query, mode = "default" } = body;
      if (!query) return json({ error: "query required" }, 400);
      const GROQ_KEY = context.env.GROQ_API_KEY;
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
          temperature: 0.7, max_tokens: 500
        })
      });
      if (!aiRes.ok) return json({ error: "AI failed", details: await aiRes.text() }, 500);
      const aiData = await aiRes.json();
      return json({ success: true, data: { answer: aiData.choices[0].message.content, key_insights: [], recommendations: [], mode }, meta: { powered_by: "SEARCH-POI Engine v1 - Cloudflare + Groq Llama3" } });
    }
    return json({ error: "Not found", route }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
