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
