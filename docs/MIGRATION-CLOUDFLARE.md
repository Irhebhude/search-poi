# Supabase → Cloudflare migration report

Status: **complete**. The frontend has zero Supabase/Lovable runtime dependencies.
Everything now talks to the project's own REST API (`/api/*`), served by Cloudflare
Pages Functions backed by D1 (database), KV (cache) and R2 (files).

## Backend (already in repo, unchanged by this pass)

| Path | Role |
| --- | --- |
| `functions/api/[[route]].ts` | Single router mounted at `/api/*` |
| `functions/api/_lib/auth.ts` | Google OAuth 2.0 + email/password, PBKDF2, HttpOnly session cookies in D1 |
| `functions/api/_lib/db.ts` | Allowlisted query compiler → D1 prepared statements |
| `functions/api/_lib/rpc.ts` | Former Postgres functions (referrals, fraud checks, points, admin) |
| `functions/api/_lib/handlers.ts` | Search AI streaming, web/news/image/video search, POI live, blueprint, build guide, deal room, public API |
| `migrations/0001_init.sql` | Full D1 schema (29 tables) |
| `wrangler.toml` | D1 / KV / R2 bindings + cron trigger |

## Frontend client

`src/lib/api.ts` is the single client: query builder (`api.from(...)`), `api.rpc`,
`api.functions.invoke`, `api.auth` (session, email/password, Google, password reset),
`api.storage` (R2) and polling channels replacing realtime.

## Files modified in this pass

Import swap `@/integrations/supabase/client` → `@/lib/api` and alias renamed to `api`:

`src/contexts/AuthContext.tsx`, `src/hooks/useIsAdmin.ts`,
`src/components/IntentAnalytics.tsx`, `LiveActivityFeed.tsx`, `ReferralGate.tsx`,
`SaveToVaultButton.tsx`, `SearchAutocomplete.tsx`, `SmartShareButton.tsx`,
`TrendingTopics.tsx`,
`src/pages/AcquisitionControl.tsx`, `AdminDashboard.tsx`, `Auth.tsx`,
`BusinessDashboard.tsx`, `Contact.tsx`, `DealRoom.tsx`, `DealRoomAdmin.tsx`,
`DeveloperDashboard.tsx`, `Feedback.tsx`, `Insights.tsx`, `KnowledgeVault.tsx`,
`POIPointsDashboard.tsx`, `Premium.tsx`, `Referral.tsx`, `ResetPassword.tsx`,
`SearchResults.tsx`, `SharedSearch.tsx`, `TrendingContent.tsx`, `Waitlist.tsx`.

Endpoint re-pointing (`<supabase>/functions/v1/*` → `/api/fn/*`, `/api/poi-live`,
`/api/poi-api`) and removal of anon-key `Authorization` headers:

`src/lib/search-api.ts`, `src/hooks/usePoiLive.ts`,
`src/components/BlueprintGenerator.tsx`, `src/components/BuildGuideViewer.tsx`,
`src/pages/DeveloperDashboard.tsx`.

Other:

- `src/pages/Auth.tsx` — Google sign-in now uses `api.auth.signInWithGoogle()` (Worker OAuth) instead of the Lovable broker.
- `src/contexts/AuthContext.tsx` — auth types now come from `@/lib/api`.
- `src/lib/api.ts` — type widening (`error.code`, channel payloads, invoke headers, `emailRedirectTo`).
- `src/test/example.test.ts` — replaced with an API-client test.

## Deleted

- `src/integrations/supabase/` (client + generated types)
- `src/integrations/lovable/`
- `supabase/` (config + 14 edge functions — all ported into `functions/api/_lib/handlers.ts`)
- packages: `@supabase/supabase-js`, `@lovable.dev/cloud-auth-js`

## Configuration

- `VITE_API_BASE_URL` (optional) — leave unset for same-origin `/api`.
- Worker secrets (`wrangler pages secret put`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `AUTH_SECRET`, `ADMIN_EMAILS`, `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `GEMINI_API_KEY`,
  `AYRSHARE_API_KEY`, `NASA_API_KEY`.
- The managed `.env` still lists `VITE_SUPABASE_*`; nothing reads them and they can be
  deleted at export time.

## Verification

- `tsgo --noEmit` — 0 errors
- `vite build` — success (993 kB / 285 kB gzip)
- `vitest run` — 1/1 passing
- Browser smoke test — app boots, routes render, no Supabase network calls

Note: `/api/*` only responds when running under Cloudflare (`wrangler pages dev` or a
deployed Pages project). In the Vite-only preview, data panels render empty by design.
