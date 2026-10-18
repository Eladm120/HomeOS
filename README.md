# HomeOS

An AI-assisted household operating system for couples and families. It is Hebrew-first, RTL and mobile-first, and it installs as a PWA. Built for Elad and Noa, with the architecture ready for many households.

---

## Status

| Area | Status |
|---|---|
| Auth (email link or password), household creation, invitations, roles | ✅ |
| Design: calm "sage" palette, light/dark, Hebrew RTL, iPhone safe areas | ✅ |
| Shared shopping list (single list = in-store mode): category cards, product pictures, photos, check → leaves to cart, offline check-off, real-time sync, finish trip → inventory | ✅ |
| Inventory: movement-based stock, thresholds, expiry, confirmed vs estimated, bulk setup, barcode/photo scan | ✅ |
| Shopping planner (home purchases by room, board/cards, alternatives comparison) | ✅ |
| Projects & repairs (tasks, troubleshooting timeline, quotes, providers, photos, linked purchases/appliances) | ✅ |
| Chores (recurring, cadence-keeping completion, history) | ✅ |
| Recipes (link import, AI from captions/photos), inventory check, missing → list; weekly meal plan | ✅ |
| AI assistant (household-scoped read tools; changes only by confirmed proposals) | ✅ needs `ANTHROPIC_API_KEY` |
| Receipt scanning → reviewed stock movements, duplicate-safe | ✅ needs AI key |
| Proactive suggestions, notifications (in-app), preferences, AI-written daily brief | ✅ |
| Utility bills (upload/manual/Gmail), analysis per day, household expenses | ✅ |
| Appliances & warranties, document vault (versions, AI indexing), shared calendar, plants | ✅ |
| Home Assistant smart-home control | ✅ needs HA URL + token |
| Google Calendar two-way sync, Gmail bill import | ✅ needs Google OAuth client |
| Global search, data export, household deletion | ✅ |
| Browser push notifications | ⏳ not built (see limitations) |

**Not yet run against the live database.** Everything above is implemented and tested locally (type-check, lint, 100+ unit/component tests, and every migration plus every SQL security test executed in an in-process Postgres). The four new migrations still need to be applied to the Supabase project before the new code is deployed — see *Deploying this version*.

---

## Architecture

A modular monolith: Next.js (App Router) + Supabase (Postgres, Auth, Storage, Realtime).

```
src/
  app/(app)/        screens (one folder per module) — server pages load data as the signed-in member
  app/api/          export, Google OAuth start/callback
  components/       UI per module; ui/ primitives (panel, sheet, field…)
  lib/              pure logic: ingredients matching, bill analysis, Home Assistant mapping,
                    recipe parsing, category styling, schemas (Zod), labels, formatting
  server/           server-only: actions (validated, household-scoped), AI client + tools,
                    integrations (Home Assistant, Google), crypto, safe fetch, search
supabase/
  migrations/       schema, RLS, RPCs, triggers (run in order)
  tests/            SQL security/integrity tests (run by `npm test` via PGlite)
tests/              Vitest: unit, component, db harness
```

### Key decisions

- **Tenant isolation in the database.** Every household row has `household_id`; RLS grants access only through `household_memberships`. Composite foreign keys keep children in their parent's household; assignees must be members of the same household. Server actions validate with Zod and also filter by household.
- **Auditable, idempotent writes.** Inventory changes only through `inventory_apply_movement` (idempotency keys). Receipts (`confirm_receipt`), chores (`complete_chore`), watering (`water_plant`) are idempotent RPCs — a double tap or a replay never double-counts.
- **AI never acts alone.** The assistant's tools read household data (each query scoped to the household, tested). Anything that changes data — groceries, tasks, smart-home commands — becomes a proposal card that a member confirms. Tool output and imported documents are treated as data, never instructions. Per-household hourly/daily AI limits and usage metering.
- **Deterministic first.** Ingredient matching, unit conversion, bill comparisons, suggestions and the daily brief facts are plain code/SQL; the model only extracts (receipts, bills, recipes, documents, plants) and phrases. Extracted data is always reviewed and marked unverified until confirmed.
- **Secrets.** No service-role key anywhere. AI and integration secrets are server-only env vars. Integration tokens are encrypted (AES-256-GCM) before storage and their column is not readable by clients.
- **Honest integrations.** Smart-home success is reported only when Home Assistant's new state reflects the command. Israeli utilities have no consumer APIs, so bills come from upload, manual entry or a read-only Gmail scan.

---

## Setup

```bash
cp .env.example .env.local    # fill the Supabase values; every other variable is optional
npm install
npm run dev                   # http://localhost:3000
npm test                      # unit + component + all migrations + SQL security tests
```

Optional server variables (each enables one feature; see `.env.example`):

| Variable | Enables |
|---|---|
| `ANTHROPIC_API_KEY` | Assistant, receipts, bill/document/recipe/plant reading, written brief |
| `INTEGRATION_ENCRYPTION_KEY` | Storing Home Assistant / Google tokens (32 random bytes, base64) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Calendar sync, Gmail bill import |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Reserved for browser push (not built yet) |

---

## Deploying this version

1. **Apply the migrations to Supabase, in order** (SQL Editor, or `npx supabase db push`):
   1. `20261017000001_foundation.sql` *(already applied)*
   2. `20261018000001_household_modules.sql`
   3. `20261018000002_intelligence.sql`
   4. `20261018000003_administration.sql`
   5. `20261018000004_integrations.sql`
2. Optional: run the SQL tests in `supabase/tests/` in the SQL Editor. Each runs in a transaction that is rolled back and ends with "… PASSED".
3. **Daily jobs:** the intelligence migration schedules `run_daily_jobs()` with `pg_cron` at 04:00 UTC when pg_cron is available. If it isn't enabled, enable it under *Database → Extensions* and run:
   `select cron.schedule('homeos-daily-jobs', '0 4 * * *', 'select public.run_daily_jobs()');`
   Suggestions are also refreshed whenever someone opens the home screen.
4. Add the optional env vars in Vercel (*Project → Settings → Environment Variables*), then push `main`; Vercel deploys automatically.
5. Google: in Google Cloud Console create an OAuth client (Web) with redirect URI `https://homeos-one-psi.vercel.app/api/integrations/google/callback`, enable the Calendar and Gmail APIs, and add both of you as test users while the app is unverified.
6. Home Assistant: in the app, *משק הבית → חיבורים*, enter a public HTTPS URL (e.g. Home Assistant Cloud) and a long-lived access token.

**Live:** https://homeos-one-psi.vercel.app (Vercel project `homeos`). Every push to `main` deploys to production.

---

## Getting started: Elad and Noa

1. Elad signs in, creates the household and picks rooms.
2. *משק הבית → הגדרות הבית → הזמנה*: create an invitation link and send it to Noa. She opens it, signs in and joins.
3. The home screen shows a short setup checklist: inventory, appliances, a first recipe, notification preferences, optional integrations.
4. iPhone: Safari → Share → **Add to Home Screen**.

---

## Known limitations

- **Push notifications** are not implemented. Notifications appear in the app (bell + page). Sending pushes needs VAPID keys and a server job that runs for all households.
- **Daily jobs** depend on `pg_cron` in Supabase. Without it, suggestions refresh only when the app is opened.
- **Home Assistant** must be reachable from the internet over HTTPS; a LAN-only address cannot be used from Vercel. Boiler timers are offered only for integrations that expose a timer service (e.g. Switcher); otherwise set auto-off in Home Assistant.
- **Instagram/Facebook** posts can't be read (no public API); the link is saved and the caption can be pasted for extraction.
- **Barcode live scan** uses `BarcodeDetector` (Android Chrome). On iPhone, photograph the product or type the number.
- **Gmail import** reads PDFs from a fixed list of Israeli bill senders (`src/server/integrations/google.ts`).
- **Offline:** the shopping list works offline once opened on the device; other screens need a connection.
- **End-to-end browser tests** against a live backend are not set up; security is covered by SQL tests and unit tests of the server tools.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Unit, component, migration and SQL security tests |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run icons` | Regenerate PWA icons |
