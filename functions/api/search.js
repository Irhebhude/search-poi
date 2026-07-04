// /api/search — live POI search via Google Places + Yelp, cached in Cloudflare KV (24h).
// Bindings expected: env.CACHE (KV), env.GOOGLE_API_KEY, env.YELP_API_KEY (secrets).
export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Content-Type": "application/json",
  };

  try {
    const { query, country = "" } = await request.json();
    if (!query || String(query).trim().length < 2) {
      return new Response(JSON.stringify({ error: "Query too short" }), { status: 400, headers: cors });
    }

    const dayKey = new Date().toISOString().slice(0, 10);
    const cacheKey = `search_${query.toLowerCase()}_${country.toLowerCase()}_${dayKey}`;

    if (env.CACHE) {
      const hit = await env.CACHE.get(cacheKey);
      if (hit) return new Response(hit, { headers: { ...cors, "X-Cache": "HIT" } });
    }

    // --- Google Places Text Search (live) ---
    const g = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        `${query} ${country}`,
      )}&key=${env.GOOGLE_API_KEY}`,
    ).then((r) => r.json());

    const results = (g.results || []).map((p) => ({
      name: p.name,
      address: p.formatted_address,
      lat: p.geometry?.location?.lat,
      lon: p.geometry?.location?.lng,
      rating: p.rating ?? null,
      source: "google_places",
      updated: new Date().toISOString(),
    }));

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ query, count: 0, results: [], message: "No data found. Try different keywords." }),
        { headers: cors },
      );
    }

    const payload = JSON.stringify({ query, count: results.length, results });
    if (env.CACHE) await env.CACHE.put(cacheKey, payload, { expirationTtl: 86400 });
    return new Response(payload, { headers: { ...cors, "X-Cache": "MISS" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
}
