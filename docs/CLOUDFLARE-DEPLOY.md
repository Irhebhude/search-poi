# SEARCH-POI Engine v1 — Cloudflare Pages production runbook

## 1. Environment variables (Pages → Settings → Environment variables → Production)

| Variable | Notes |
| --- | --- |
| `VITE_API_BASE_URL` | `https://search-poi.pages.dev` (build-time, must also exist in Preview) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth web client. Authorised redirect URI: `https://search-poi.pages.dev/api/auth/callback/google` |
| `AUTH_SECRET` | 32-char random string |
| `ADMIN_EMAILS` | `prosperozoya50@gmail.com` |
| `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY` | LLM fallback chain, in that order |
| `AYRSHARE_API_KEY`, `NASA_API_KEY` | Distribution + space-weather panels |

Missing Google keys no longer crash the app: `GET /api/config` reports
`google: false` and the sign-in screen shows "Auth not configured".

## 2. Bindings (`wrangler.toml`)

- **KV** `CACHE` — semantic-search + live-data cache (1 h TTL)
- **D1** `DB` — `search-poi-db`
- **AI** `AI` — embeddings `@cf/baai/bge-base-en-v1.5`, text fallback `@cf/meta/llama-3.1-8b-instruct`
- **R2** `BUCKET` — kept but **commented out** because the deploy fails with
  `R2 bucket 'search-poi-files' not found` until the bucket exists. Create it and
  uncomment the block:

  ```sh
  npx wrangler r2 bucket create search-poi-files
  ```

  All `env.BUCKET` usage is guarded and returns `501 {"error":"File uploads disabled"}`,
  so the app deploys and runs without R2.

## 3. Database migrations

```sh
npm run db:migrate          # remote (production D1)
npm run db:migrate:local    # local dev
```

`migrations/0003_semantic_support.sql` creates `pois` (with `embedding TEXT`),
`support_tickets` and `analytics`. On a database where `pois` already exists:

```sql
ALTER TABLE pois ADD COLUMN embedding TEXT;
```

## 4. Semantic search

- `POST /api/semantic-search` `{ query, limit }` → top-20 POIs by cosine similarity.
- `POST /api/semantic-search/reindex` `{ limit }` → backfills embeddings for rows
  where `embedding IS NULL`.
- Results are cached in KV for 1 hour under `sem:<topK>:<query>`.

## 5. LLM fallback order

`GROQ → OPENROUTER → GEMINI → Workers AI`. The Workers AI leg needs no key and
returns an OpenAI-shaped response (including a single-chunk SSE stream), so AI
answers keep working even with every third-party key exhausted.

## 6. Routing

`functions/api/[[route]].ts` exports `onRequest` and handles everything under
`/api/*`. Pages Functions take precedence over static assets, so the SPA
fallback in `public/_redirects` (`/* /index.html 200`) does not shadow the API
and does not loop.

## 7. Deploy

```sh
npm run cf:deploy
```

## 8. SDKs

- `sdk/searchpoi.js` — browser/Node, zero deps
- `sdk/searchpoi.py` — Python, `requests`
