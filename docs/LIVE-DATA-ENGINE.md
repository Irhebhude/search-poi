# SEARCH-POI — Live Data Engine

The search engine now returns **real business/POI data** from live sources. No fake
names, no hallucinated phone numbers. If a source returns nothing, the UI shows
`"No live data found. Try different keywords."`

## Data sources (all free, no API key required)

- **Nominatim** (OpenStreetMap geocoding) — turns a query like `Restaurants Lekki`
  into coordinates. Picks the most specific real place (city/suburb/island) over
  huge admin boundaries or unrelated same-named businesses.
- **Overpass API** (OpenStreetMap POI database) — returns real businesses around
  the coordinates: name, category, address, phone, website, GPS. Three mirrors are
  tried for reliability.

## Caching (kills repeat API calls — same idea as Cloudflare KV)

Results are cached in the `poi_cache` table for 24h.
Key format: `"<query>::<limit>::<YYYY-MM-DD>"` (e.g. `ikeja fuel::50::2026-04-29`).

## Where the code lives (current Lovable stack)

- Edge function: `supabase/functions/poi-live-search/index.ts`
- Frontend helper + CSV export: `src/lib/search-api.ts` (`livePoiSearch`, `poiToCsv`)
- UI: `src/components/LocationSearch.tsx` (loading state + CSV download button)

---

## Porting to Cloudflare Pages + Workers (your own deploy)

The logic is portable. To move it off this stack:

1. **Worker** — copy the body of `poi-live-search/index.ts` into
   `functions/api/search.js`. Replace the Supabase cache read/write with
   Cloudflare KV:
   ```js
   const cached = await env.POI_KV.get(cacheKey, "json");
   // ...
   await env.POI_KV.put(cacheKey, JSON.stringify(results), { expirationTtl: 86400 });
   ```
2. **CSV endpoint** — port `poiToCsv` into `functions/api/export-csv.js`.
3. **Frontend** — change the fetch URL in `src/lib/search-api.ts` from the Supabase
   function URL to `/api/search`.
4. **Config** — add `wrangler.toml` with a KV binding named `POI_KV`, and a
   `public/_redirects` file containing `/* /index.html 200`.
5. **No keys needed** — Nominatim + Overpass are keyless. Optionally add Google
   Places / Yelp keys as extra sources later, but they are NOT required.

Free forever until Overpass/Nominatim fair-use limits (thousands of requests/day),
which the 24h cache keeps you well under.
