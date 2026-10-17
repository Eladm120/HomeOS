# HomeOS

An AI-assisted household operating system for couples and families. It is Hebrew-first, RTL and mobile-first, and it is a PWA.

This repository holds **Phase 1**, the first working slice of the product:

> Authentication → shared household → grocery list with photos → inventory → real-time sync → mobile dashboard

---

## Status

| Area | Status |
|---|---|
| Email sign-in (one-time code **or** password) | ✅ Built |
| Household creation, invitation link, joining, roles (owner/member) | ✅ Built |
| Rooms, product categories, storage locations (customizable) | ✅ Built |
| Shared grocery list: photos, categories, brand/variant, notes, urgency, duplicate merge, undo-delete | ✅ Built |
| Real-time sync between devices (Supabase Realtime) | ✅ Built |
| Shopping Mode: large targets, photos, category filter, **offline check-off queue** | ✅ Built |
| Finish trip → reviewed transfer of purchased items into inventory | ✅ Built |
| Inventory: auditable stock movements (add/consume/count/discard/transfer), thresholds, expiry, confirmed vs. estimated stock | ✅ Built |
| Guided bulk initial inventory (paste a list, review, import; draft saved on device) | ✅ Built |
| Deterministic usage-based depletion estimate (labelled as an estimate) | ✅ Built |
| Home dashboard: greeting, Hebrew calendar date, daily brief from real data, low stock → add to list, expiring items, activity feed | ✅ Built |
| PWA: manifest, icons, iOS safe areas, service worker for offline Shopping Mode | ✅ Built |
| Light / dark theme | ✅ Built |
| Recipes, meal planning | ⏳ Phase 2 (honest "in progress" screen in the app) |
| Chores, projects & repairs, shopping planner | ⏳ Phase 2 |
| AI assistant, receipt scanning, AI daily brief, barcode camera scanning | ⏳ Phase 3 |
| Utilities, expenses, appliances, documents, calendar, plants | ⏳ Phase 4 |
| Home Assistant, Google Calendar, Gmail, utility connectors | ⏳ Phase 5 |

---

## Architecture

A modular monolith on Next.js (App Router) and Supabase. The phases build on each other in order.

```
src/
  app/                    routes (Hebrew UI, RTL)
    (app)/                authenticated shell: dashboard, shopping, inventory, household
    sign-in, onboarding, invite/[token], auth/confirm, setup, offline
  components/             UI (ui/ primitives in the shadcn style, feature folders)
  hooks/                  client hooks (grocery realtime + offline queue, realtime refresh)
  lib/                    pure domain logic (format, validation, grocery, inventory, offline queue)
  server/                 server-only: request context, server actions, logging, media signing
supabase/
  migrations/             SQL schema, RLS, RPCs, storage, realtime
  tests/rls_isolation.sql tenant-isolation test script
tests/                    Vitest unit + component tests
```

### Key decisions

- **Two layers of security.** Every household-owned row has a `household_id`. PostgreSQL Row Level Security only grants access through `household_memberships`, so access does not depend on the UI. Server actions also validate input with Zod and scope every query to the active household.
- **Tenant integrity in the schema itself.** Composite foreign keys such as `(list_id, household_id) → shopping_lists(id, household_id)` make it impossible to link a row to another household's parent row, even by mistake.
- **Inventory is movement-based.** `inventory_items.quantity` is a cache. Clients cannot write it, because column privileges are revoked. It changes only through the `inventory_apply_movement` RPC, which locks the row, writes an auditable `inventory_movements` record and supports **idempotency keys**. Phase 3 receipt imports reuse this, so a duplicate receipt line can never double-count stock.
- **Confirmed vs. estimated stock.** Counting ("ספירה") marks stock *confirmed* and timestamps it. Consuming more than recorded clamps stock to 0 and marks it *estimated*.
- **Offline-safe grocery check-off.** Check-offs are queued as idempotent "set status" operations, never toggles. The queue is stored in IndexedDB and replayed when the connection returns. Each row carries a `version` that a trigger bumps on every update, so stale realtime events are ignored. Edits use optimistic concurrency and refuse to overwrite a newer change from your partner.
- **Private media.** Images go into a private bucket under `{household_id}/…`, and storage RLS enforces that path. The browser compresses each photo and creates a thumbnail before upload, which also strips EXIF/GPS data. Images are shown through short-lived signed URLs.
- **No service-role key.** Phase 1 never uses the service-role key. All server code runs as the signed-in user.
- **Bootstrap through RPCs.** Household creation and invitations go through `SECURITY DEFINER` RPCs that check authorization themselves. Invitation tokens are 192-bit random values, only their SHA-256 hash is stored, they are single-use, expire after 7 days, and can optionally be bound to one email.
- **Audit trail.** Triggers write `activity_events` for important actions (household, membership, invitations, grocery and inventory changes).

---

## Setup

### 1. Supabase project
1. Create a project at [supabase.com](https://supabase.com). Region: `eu-central-1` (Frankfurt) is closest to Israel.
2. Open **SQL Editor**, paste the contents of `supabase/migrations/20261017000001_foundation.sql` and run it.
   With the Supabase CLI instead: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. **Authentication → URL Configuration**:
   - Site URL: your app URL (for example `http://localhost:3000` locally, or the production domain).
   - Redirect URLs: add `http://localhost:3000/auth/confirm` and `https://<your-domain>/auth/confirm`.
4. **Authentication → Email Templates → Magic Link**: add `{{ .Token }}` to the template so users get a 6-digit code. Codes work better than links inside an installed iPhone PWA, because iOS opens email links in Safari, not in the PWA.
5. *(Recommended)* **Authentication → SMTP**: configure your own SMTP provider. Supabase's built-in email only sends a few messages per hour. Until then, use the **password** tab on the sign-in screen.

### 2. Environment
```bash
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL
```

### 3. Run
```bash
npm install
npm run dev        # http://localhost:3000
```

### 4. Verify the database security (recommended)
Paste `supabase/tests/rls_isolation.sql` into the SQL Editor and run it. It should print `ALL RLS TESTS PASSED`. It runs inside a transaction that is rolled back, so it leaves no data behind.

---

## Getting started: Elad and Noa

1. **Elad** opens the app and signs in with his email, using either the code or a password.
2. Onboarding: enter your name and the household name, then choose rooms. **Create household.**
3. **Invite Noa**: generate an invitation link (optionally bound to Noa's email) and send it on WhatsApp.
4. Add the initial inventory: **Household → Inventory → Bulk entry**. Paste one list per location (fridge, freezer, pantry…), review, then save. The draft is saved on the device, so you can continue later.
5. **Noa** opens the link, signs in, taps "הצטרפות למשק הבית" (Join household) and enters her name.
6. Both of you now share the same grocery list and inventory in real time.

**On iPhone:** open the site in Safari → Share → **Add to Home Screen**.

---

## Deployment

**Live:** https://homeos-one-psi.vercel.app (Vercel project `homeos`, team `elads-projects-2cf4626c`).

- Every push to `main` deploys to production automatically (GitHub ↔ Vercel connected).
- The public Supabase URL and publishable key ship in `.env.production`. They are browser-safe, and RLS enforces access. Never put secrets in that file.
- Invitation links use the request's own origin, so no site-URL variable is needed.
- Supabase Auth: the Site URL is the production domain, and both `https://homeos-one-psi.vercel.app/**` and `http://localhost:3000/**` are allowed redirects.
- Manual deploy from this folder: `npx vercel deploy --prod --scope elads-projects-2cf4626c`.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest unit + component tests |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run icons` | Regenerate PWA icons |

---

## Known limitations (Phase 1)

- **Not yet tested against a live Supabase project.** Typecheck, lint, the production build and 48 unit/component tests pass locally. The SQL migration and `rls_isolation.sql` were written but **not executed**, because no database was available in the build environment. Run step 4 above after setup.
- **No end-to-end browser tests yet.** The two-device sync flow needs a live backend. Playwright E2E tests are planned for Phase 6.
- **Offline:** only Shopping Mode works offline, and only if it was opened at least once on that device while online. Adding or editing items requires a connection. iOS may evict the offline cache after several weeks without use.
- **Barcode scanning** in Phase 1 is a manual barcode field. Camera scanning arrives in Phase 3: native `BarcodeDetector` on Android, and a JS decoder on iOS, where the native API is missing.
- **Push notifications** are not built yet. iOS supports web push only for PWAs installed on the Home Screen (iOS 16.4+).
- **Images:** HEIC photos rely on the browser to decode them. Safari does; desktop Chrome may not.
- Supabase **image transformations** (a paid feature) are not used. Thumbnails are generated in the browser.

## Integrations that will need configuration later

| Integration | Needed for | What you'll need |
|---|---|---|
| LLM provider (Claude) | AI assistant, receipt/recipe/bill extraction | `ANTHROPIC_API_KEY` (server-only) |
| Home Assistant | Smart home (AC, boiler, lights) | HA URL reachable from the server + long-lived access token |
| Google Calendar / Gmail | Calendar sync, bill ingestion from email | Google Cloud OAuth client (consent screen, scopes) |
| Israeli utilities (IEC, water corp., municipality) | Bill import | No public consumer APIs are known; the plan is email ingestion + PDF/photo upload |
| SMTP provider | Reliable sign-in emails | e.g. Resend / Postmark credentials in Supabase Auth settings |
