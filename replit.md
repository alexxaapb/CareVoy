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

### Add to Calendar (after booking)
- `lib/addToCalendar.ts` builds a Google Calendar template URL via `expo-linking`. Works on iPhone, Android, and web — opens in the user's default browser to save to whatever calendar account they prefer.
- Wired into `app/book-ride.tsx` step 4 (success screen) — single "Add to my calendar" button after the ride is confirmed. Reminder is anchored to the surgery time (1-hour duration) with pickup time and ride details in the description.
- Deliberately chose this over OAuth-based "calendar scanning" — no client IDs, no Google verification, no permissions to manage, works for any calendar provider.

