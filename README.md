# SEARCH-POI ENGINE v1 — Cloudflare Deployment

This repo runs today on Lovable Cloud. The `/functions` folder, `wrangler.toml`,
`schema.sql`, and `public/_redirects` are the **Cloudflare export layer** — they let a
buyer host the exact same React frontend on Cloudflare Pages with Cloudflare Workers
handling live APIs, with zero platform license fees.

## Deploy to Cloudflare (free until ~10k searches/month)

1. **Push to GitHub**, then create a Cloudflare Pages project pointing at the repo.
   - Build command: `npm run build`
   - Output directory: `dist`
2. **Create resources:**
   ```bash
   wrangler kv:namespace create CACHE          # copy id -> wrangler.toml
   wrangler d1 create search-poi-db            # copy id -> wrangler.toml
   wrangler d1 execute search-poi-db --file=./schema.sql
   wrangler r2 bucket create voice-notes
   ```
3. **Add secrets:**
   ```bash
   wrangler secret put GOOGLE_API_KEY
   wrangler secret put MAPBOX_KEY
   wrangler secret put YELP_API_KEY
   wrangler secret put ICS_API_KEY
   ```
4. **Deploy** — Pages auto-builds on push. Functions in `/functions/api/*` deploy with it.

## Endpoints (Cloudflare Pages Functions)

| Route         | Purpose                                    |
|---------------|--------------------------------------------|
| `/api/time`   | Server clock for drift correction          |
| `/api/search` | Live POI search (Google Places + KV cache) |
| `/api/gps`    | Reverse geocode via Mapbox                  |
| `/api/export` | JSON → CSV download                         |

Point the frontend fetch calls at `/api/*` once running on Cloudflare.

## Live date/time engine

`src/components/LiveClock.tsx` ticks every second off the device clock with
auto timezone detection — no hardcoded dates. On Cloudflare, sync it against
`/api/time` every 60s to correct clock drift.

## Legal

This code contains zero proprietary platform dependencies in the export layer.
Buyer owns 100% of the code. ICS + Truth Engine live data requires a separate
monthly data license.

## Quick start (zero local wrangler)

1. Push to GitHub and connect the repo to Cloudflare Pages (build `npm run build`, output `dist`).
2. Cloudflare Dashboard → **D1** → Create database named `search-poi-db`.
3. Pages → your project → **Settings → Bindings** → add D1 binding `DB` → **Retry deployment**.
   (Optional: KV namespace `CACHE`, Workers AI binding `AI`.)
4. Test: https://search-poi.pages.dev/api/health and https://search-poi.pages.dev/api/debug

The `pois` table is created and auto-seeded on first request, so no migration run is required.

### In-app diagnostics & tools

| Route | Purpose |
|---|---|
| `/status` | System Status widget (Workers AI, D1, KV, config) + DB debug + **Reindex POIs** |
| `/support` | Submit a ticket and track its status |
| `/admin/support` | Admin queue: reply, close, reopen tickets |
| `/explore` | Search / Add POI tabs with Leaflet map and "Use my location" |

### API

| Route | Purpose |
|---|---|
| `GET /api/health` | Binding + AI/D1/KV/config health |
| `GET /api/debug` | `binding_found`, `table_exists`, `row_count`, `env_keys` |
| `GET /api/pois?q=` | Search POIs by name/description |
| `GET /api/pois/near?lat=&lon=&radius=5` | Haversine radius search (km) |
| `POST /api/pois` | Create a POI (`name`, `latitude`, `longitude` required) |
| `GET/POST/PATCH /api/tickets` | Support tickets (PATCH is admin-only) |
| `POST /api/semantic-search/reindex` | Backfill Workers AI embeddings |

Every route returns `{ error, details, help }` on failure, where `help` names the exact
Cloudflare screen to open.
