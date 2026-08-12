# SEARCH-POI — agent memory

## Stack & tooling
- Cloudflare Pages + Functions (Workers runtime). API lives in `functions/api/[[route]].ts` — a single router mounted at `/api/*`.
- Frontend: Vite + React + shadcn/ui + Tailwind. Source in `src/`. Static assets in `public/` (served as-is, SPA fallback `/* /index.html 200` only applies when no static file matches).
- Bindings (wrangler.toml): `CACHE` (KV), `API_KEYS` (KV — public API keys), `DB` (D1), `AI` (Workers AI), `BUCKET` (R2, commented until bucket is created).
- Package manager: bun (`bun.lock`/`bun.lockb`) is canonical; `package-lock.json` also present. Do NOT commit `package-lock.json` changes that only come from running `npm install` — revert them unless deps were actually added to `package.json`.
- Tests: `vitest` (config in `vitest.config.ts`, includes `src/**/*.{test,spec}.{ts,tsx}`). Run with `npx vitest run`. Workers-types (`D1Database`, `KVNamespace`, `R2Bucket`) are NOT in the repo's tsconfig — they come from wrangler at build time, so standalone `tsc` on `functions/**` reports "Cannot find name" errors that are expected/pre-existing.

## Conventions
- `_lib/` modules export typed helpers + route handlers; the router dispatches by `head` (first path segment).
- JSON responses via the local `json()` helper. CORS is applied by `withCors`/`cors()` in the router (origin defaults to `*`, allowed headers include `x-api-key`).
- API keys for the public v1 API live in KV (`env.API_KEYS`) as JSON records `{ api_key, created_at, is_active }`, keyed by the raw key string. See `functions/api/_lib/keys.ts`.

## Public API key flow (v1)
- `POST /api/generate-key` → `{ api_key: "spoi_live_sk_…", status: "success" }` (no auth required to generate).
- Auth on protected endpoints (`/api/search`, `/api/index`): `x-api-key` header OR `?api_key=` query. Invalid/missing/revoked → `401 { "error": "Invalid API key" }`.
- `POST /api/revoke-key` `{ api_key }` → sets `is_active=false`.
- Public key generator UI: `public/generate.html`.

## UI theme (SEARCH-POI ENGINE v1 — cyan dark)
- Design tokens live in `src/index.css` as HSL CSS variables (consumed by tailwind.config.ts). `.glass` utility = `rgba(20,20,30,0.6)` + `backdrop-blur-md`. Font = Inter (set in tailwind.config `fontFamily.sans` + index.css body).
- Key colors: bg `#0A0A0F`, fg `#FFFFFF`, primary `#00F0FF` (cyan), accent/hover `#00D4FF`, muted-fg `#A0A0B0`, destructive `#FF3B30`, input `#1A1A24`, green `#00FF88`.
- Exact icon colors on home quick-action cards are applied via inline `style={{color}}` (not tailwind classes) in `src/pages/Index.tsx` and `src/components/HomeQuickActions.tsx`: POS `#FFD700`, Fuel `#00FF88`, Traffic `#FFA500`, Danger `#FF3B30`.
- Hero title uses the `.gradient-text` utility (cyan→white). "INTELLIGENT REASONING" badge in AIAnswer is solid `bg-[#00F0FF] text-black`. Confidence value is `text-[#00F0FF]`.

## Gotchas
- `functions/api/[[route]].ts` must end with exactly one `export const onSchedule`. An earlier version had a corrupted/duplicated tail (a `onSchedule` line concatenated with `/api/keys/generate` followed by a duplicate route block) — keep it clean.
- `env.API_KEYS` must be bound in wrangler.toml; create the namespace with `npx wrangler kv namespace create API_KEYS` and replace the placeholder ids.
