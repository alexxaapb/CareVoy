# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## CareVoy Mobile App

Located at `artifacts/carevoy/`. Expo React Native app (web + iOS + Android).

**Theme**: white surfaces with navy text, teal primary, gold accent.
- Tokens in `lib/theme.ts` and `constants/colors.ts` (must stay in sync).
- App locked to light mode via `app.json` `userInterfaceStyle: "light"`.
- Colors: BG `#FFFFFF`, text `#050D1F`, muted `#6B7280`, primary teal `#00C2A8`, accent gold `#F5A623`, card `#F8FAFC`, border `#E2E8F0`.

**Brand logo**: `assets/images/logo-motion.png` (used on login screen).

**Backend**: Supabase + Replit api-server (`artifacts/api-server`).

**Module conventions**:
- Single Supabase client at `lib/supabase.js` — depth-correct relative imports only (no shim copies in `app/`).
- `react-native-maps` is web-incompatible — always import via `lib/maps` (resolves to `maps.native.ts` on iOS/Android, `maps.web.ts` on web). `lib/maps.d.ts` provides TS types.

## Recent Features

### Family Caregiver Mode
- `caregivers` table (in `database/schema.sql`) links a caregiver `auth.users.id` to one or more patient rows with consent + permission flags (`can_book_rides`, `can_view_receipts`).
- `add_care_recipient` Postgres SECURITY DEFINER RPC creates the patient row and caregiver link in one call.
- `lib/careContext.tsx` provides a CareProvider with `activePerson` (self or recipient) persisted in AsyncStorage. Wraps the app in `app/_layout.tsx`.
- Home screen (`app/(tabs)/index.tsx`) shows a "Booking for" pill switcher when caregivers exist; rides query uses `activePerson.patientId`.
- Settings (`app/settings.tsx`) "People in my care" section lists recipients and links to `app/care/add.tsx` (consent checkbox required).
- Booking flow (`app/book-ride.tsx`) shows "Booking for X" banner when active person isn't self; uses recipient's patient_id and address.
- Onboarding step 4 ("Who will use CareVoy?") asks the user if they're booking for themselves or someone in their care; "someone in my care" deep-links to `/care/add?from=onboarding`, which refreshes auth and lands on the home tab on success. The auth guard in `app/_layout.tsx` allows `top === "care"` while a patient is mid-onboarding so the guard can't bounce them back.
- RLS policies updated to allow caregivers with active+can_book_rides to read/update patients and rides; caregivers with can_view_receipts can read receipts.

### Address autocomplete & required-field markers
- `lib/addressAutocomplete.ts` queries OpenStreetMap Nominatim (free, no API key, US-filtered, 5 results max). Cancels in-flight requests via AbortController; debounce lives in the consumer (350ms in `AddressInput`).
- `components/AddressInput.tsx` — reusable TextInput + suggestions dropdown. Used in `book-ride.tsx` (pickup address) and `onboarding.tsx` (home address). Accepts `inputStyle` to match the surrounding screen's existing styles.
- `components/Required.tsx` — small red asterisk used after required field labels (full name, email, DOB, address, emergency contact name+phone, surgery date/time, destination facility, pickup address).
- `book-ride.tsx` Destination Facility field is now an inline `FacilityAutocomplete` (typeahead over the static Columbus-area list filtered by facility type, plus an "Other" row that captures whatever the user typed). The previous Modal-based picker is gone.
- Surgery date/time pickers use `themeVariant="light"` + `textColor={NAVY}` + `accentColor={TEAL}` (the previous `themeVariant="dark"` rendered white text against the white app surface on iOS).
- Settings has a "Restart onboarding" row that flips `patients.onboarding_complete` to false and routes to `/onboarding` so the new "Who will use CareVoy?" step is reachable for testing without recreating the account. **Schema gotcha:** `patients.id` IS the auth user id (no separate `user_id` column). All updates must use `.eq("id", userId)`, not `.eq("user_id", userId)`.

### Payment screen — Stripe Checkout (real payments)
- `app/(tabs)/payment.tsx` no longer collects raw card data. The card-collection forms were replaced with a single "Add a payment method" button that opens **Stripe Checkout** in an in-app browser sheet (`expo-web-browser` `openBrowserAsync`). On iOS Safari / Android Chrome, Stripe Checkout natively renders Apple Pay / Google Pay buttons alongside the card form.
- `lib/paymentsApi.ts` is the thin client. `getReturnUrl()` uses `https://${EXPO_PUBLIC_DOMAIN}/api/payments/return` so the same URL works in dev preview and in published deploys (proxy routes `/api` to the api-server).
- After the user dismisses the sheet we re-fetch saved methods and update `patients.stripe_customer_id` from the returned `cus_…` id (client-side via Supabase RLS, since the api-server has no service-role key).
- HSA / FSA: the page now shows a "TAX-FREE ✓" callout instead of a separate HSA card form. HSA debit cards are saved through the same Stripe flow — the IRS Code 213(d) receipt is generated server-side after each ride.

### Stripe wiring (`artifacts/api-server`)
- `src/lib/stripeClient.ts` — `getUncachableStripeClient()` (per-call, never cached), `getStripePublishableKey()`, `getStripeSync()` (singleton), and `initStripe(logger)` which runs `runMigrations({ databaseUrl })` → registers a managed webhook at `https://${REPLIT_DOMAINS.split(",")[0]}/api/stripe/webhook` → `syncBackfill()`.
- Credentials come from the **Replit Stripe connector** (no env-var keys) — `REPLIT_CONNECTORS_HOSTNAME` + `REPL_IDENTITY` / `WEB_REPL_RENEWAL`. Selects `production` env when `REPLIT_DEPLOYMENT=1`, else `development`.
- Stripe API version pinned to **2025-11-17.clover** to match the installed `stripe@20.0.0` types.
- `src/app.ts` registers `/api/stripe/webhook` with `express.raw({ type: "application/json" })` **before** `express.json()` so signature verification has the original bytes. The handler calls `stripeSync.processWebhook(body, signature)` to upsert into the local `stripe.*` schema.
- `src/index.ts` `await initStripe(logger)` runs **before** `app.listen` so migrations + the managed webhook are ready on first request.
- **`stripe-replit-sync` is externalized in `build.mjs`** because it does `path.resolve(__dirname, "./migrations")` to find its bundled `.sql` files. Bundling the package with esbuild breaks `__dirname`, so the migration loader silently no-ops and downstream queries blow up with `relation "stripe.accounts" does not exist`. Keeping it external resolves the migrations directory at runtime from `node_modules/`.
- Routes (`src/routes/payments.ts`):
  - `GET /api/payments/config` → `{ publishableKey }`.
  - `POST /api/payments/setup-session` → creates/retrieves a Stripe customer with `metadata.patient_id`, then a `mode: "setup"` Checkout Session, returns `{ url, customerId }`.
  - `GET /api/payments/methods?customerId=cus_...` → live `paymentMethods.list` (card type) → `[{ id, brand, last4, expMonth, expYear }]`.
  - `DELETE /api/payments/methods/:id` → `paymentMethods.detach`.
  - `GET /api/payments/return` → friendly "Payment method saved" HTML page Stripe redirects to after Checkout.
- Packages (`stripe@20.0.0`, `stripe-replit-sync@1.0.0`) live at the **workspace root** (per the integration skill) — pnpm hoists them so the api-server can import them without redeclaring.

### Add to Calendar (after booking)
- `lib/addToCalendar.ts` builds a Google Calendar template URL via `expo-linking`. Works on iPhone, Android, and web — opens in the user's default browser to save to whatever calendar account they prefer.
- Wired into `app/book-ride.tsx` step 4 (success screen) — single "Add to my calendar" button after the ride is confirmed. Reminder is anchored to the surgery time (1-hour duration) with pickup time and ride details in the description.
- Deliberately chose this over OAuth-based "calendar scanning" — no client IDs, no Google verification, no permissions to manage, works for any calendar provider.

