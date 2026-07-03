import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Maps common query words to OpenStreetMap tags so we return REAL POIs only.
const CATEGORY_TAGS: { keywords: string[]; filters: string[] }[] = [
  { keywords: ["fuel", "petrol", "gas station", "filling"], filters: ['["amenity"="fuel"]'] },
  { keywords: ["restaurant", "food", "eatery", "eat", "buka"], filters: ['["amenity"="restaurant"]', '["amenity"="fast_food"]'] },
  { keywords: ["hotel", "lodge", "accommodation", "guest house"], filters: ['["tourism"="hotel"]', '["tourism"="guest_house"]'] },
  { keywords: ["hospital", "clinic", "health", "medical", "pharmacy", "chemist"], filters: ['["amenity"="hospital"]', '["amenity"="clinic"]', '["amenity"="pharmacy"]'] },
  { keywords: ["bank", "atm"], filters: ['["amenity"="bank"]', '["amenity"="atm"]'] },
  { keywords: ["school", "college", "university"], filters: ['["amenity"="school"]', '["amenity"="university"]', '["amenity"="college"]'] },
  { keywords: ["supermarket", "market", "grocery", "shop", "store"], filters: ['["shop"="supermarket"]', '["shop"="convenience"]', '["shop"]'] },
  { keywords: ["cafe", "coffee"], filters: ['["amenity"="cafe"]'] },
  { keywords: ["bar", "club", "lounge", "nightlife"], filters: ['["amenity"="bar"]', '["amenity"="pub"]', '["amenity"="nightclub"]'] },
  { keywords: ["church", "mosque", "worship"], filters: ['["amenity"="place_of_worship"]'] },
];

function pickFilters(query: string): string[] {
  const q = query.toLowerCase();
  for (const c of CATEGORY_TAGS) {
    if (c.keywords.some((k) => q.includes(k))) return c.filters;
  }
  // Generic fallback: any named business/amenity/shop.
  return ['["amenity"]["name"]', '["shop"]["name"]'];
}

// All category keywords + noise words we strip to isolate the location for geocoding.
const NOISE_WORDS = new Set([
  ...CATEGORY_TAGS.flatMap((c) => c.keywords.flatMap((k) => k.split(" "))),
  "top", "best", "near", "me", "in", "at", "the", "a", "of", "and", "list", "stations",
  "station", "places", "place", "around", "close", "to", "50", "100", "1000", "businesses",
  "business", "companies", "company", "services", "service", "spots", "spot",
]);

function extractLocation(query: string): string {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w) && isNaN(Number(w)));
  const loc = words.join(" ").trim();
  return loc || query;
}


interface POI {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string | null;
  website: string | null;
  lat: number;
  lon: number;
  mapUrl: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, limit = 50 } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Query must be at least 2 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanQuery = query.trim().slice(0, 200);
    const maxResults = Math.min(Math.max(Number(limit) || 50, 1), 200);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- 1. Cache check (like Cloudflare KV) ----
    const dayKey = new Date().toISOString().slice(0, 10);
    const cacheKey = `${cleanQuery.toLowerCase()}::${maxResults}::${dayKey}`;
    const { data: cached } = await supabase
      .from("poi_cache")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(
        JSON.stringify({ query: cleanQuery, cached: true, count: (cached.payload as POI[]).length, results: cached.payload }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- 2. Geocode the location part via Nominatim (keyless, free) ----
    // Fetch several candidates and prefer real places (city/town/suburb/region)
    // over unrelated businesses that happen to share the name.
    const geocode = async (q: string) => {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=10&addressdetails=1`,
        { headers: { "User-Agent": "SEARCH-POI/1.0 (poi-live-search)" } },
      );
      const list = await r.json();
      if (!Array.isArray(list) || list.length === 0) return null;
      const places = list.filter((x: any) => x.class === "place" || x.class === "boundary");
      const pool = places.length ? places : list;
      pool.sort((a: any, b: any) => (b.importance || 0) - (a.importance || 0));
      return pool[0];
    };

    const locationPart = extractLocation(cleanQuery);
    let best = await geocode(locationPart);
    if (!best) best = await geocode(cleanQuery);

    if (!best) {
      return new Response(
        JSON.stringify({ query: cleanQuery, count: 0, results: [], message: "No live data found. Try different keywords." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const geoData = [best];
    const lat = parseFloat(best.lat);
    const lon = parseFloat(best.lon);
    const radius = 6000; // metres


    // ---- 3. Query Overpass API for REAL POIs around the location ----
    const filters = pickFilters(cleanQuery);
    const clauses = filters
      .map((f) => `node${f}(around:${radius},${lat},${lon});way${f}(around:${radius},${lat},${lon});`)
      .join("");
    const overpassQuery = `[out:json][timeout:25];(${clauses});out center ${maxResults};`;

    const OVERPASS_MIRRORS = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ];

    let opData: any = null;
    for (const mirror of OVERPASS_MIRRORS) {
      try {
        const opResp = await fetch(mirror, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(overpassQuery)}`,
        });
        if (opResp.ok) {
          opData = await opResp.json();
          break;
        }
      } catch (_) {
        // try next mirror
      }
    }

    if (!opData) {
      return new Response(
        JSON.stringify({ query: cleanQuery, count: 0, results: [], message: "Live data source is busy. Try again shortly." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const elements: any[] = opData.elements || [];

    const results: POI[] = elements
      .map((el) => {
        const t = el.tags || {};
        const name = t.name || t["name:en"] || t.brand || t.operator;
        if (!name) return null; // NEVER return unnamed/fake entries
        const plat = el.lat ?? el.center?.lat;
        const plon = el.lon ?? el.center?.lon;
        if (plat == null || plon == null) return null;
        const addressParts = [t["addr:housenumber"], t["addr:street"], t["addr:city"], t["addr:state"]].filter(Boolean);
        const category = t.amenity || t.shop || t.tourism || "business";
        return {
          id: `${el.type}/${el.id}`,
          name,
          category: String(category).replace(/_/g, " "),
          address: addressParts.join(", ") || (geoData[0].display_name as string),
          phone: t.phone || t["contact:phone"] || null,
          website: t.website || t["contact:website"] || null,
          lat: plat,
          lon: plon,
          mapUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        } as POI;
      })
      .filter((x): x is POI => x !== null)
      // de-duplicate by name+coords
      .filter((v, i, arr) => arr.findIndex((o) => o.name === v.name && o.lat === v.lat) === i)
      .slice(0, maxResults);

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ query: cleanQuery, count: 0, results: [], message: "No live data found. Try different keywords." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- 4. Store in cache (24h TTL) ----
    await supabase.from("poi_cache").upsert(
      {
        cache_key: cacheKey,
        query: cleanQuery,
        payload: results as unknown as Record<string, unknown>,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "cache_key" },
    );

    return new Response(
      JSON.stringify({ query: cleanQuery, cached: false, count: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("poi-live-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
