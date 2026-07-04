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
