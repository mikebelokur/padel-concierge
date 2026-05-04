# Padel Concierge

## Overview

Premium padel player matchmaking platform for Dubai. A quality-control system (not a booking platform) that automatically suggests partners, verifies skill levels, and provides play analytics.

**Philosophy:** "What can be analyzed can be controlled."

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS v4 (dark-only theme)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Charts**: Recharts
- **Routing**: Wouter

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

- **Padel Concierge** (`artifacts/padel-concierge/`) — Main React frontend at `/`
- **API Server** (`artifacts/api-server/`) — Express 5 backend at `/api`

## Database Schema

- `users` — Players, coaches, and admins with availability, levels, and favourites
- `matches` — Match records with player lists, format, status, and scoring
- `bookings` — Match bookings with payment status and warm-up tracking
- `video_analyses` — Video submissions and AI analysis reports
- `activity_logs` — Real-time activity feed for admin dashboard

## Test Accounts

| Role   | Email                           | Password   |
|--------|---------------------------------|------------|
| Admin  | admin@padelconcierge.com        | admin123   |
| Coach  | coach@padelconcierge.com        | coach123   |
| Player | player@padelconcierge.com       | player123  |

## Feature Highlights

- **Smart Matchmaking**: Groups players by level (max 1-level gap), intensity, and location; outputs 4 suggestion types (Best/Balanced/Challenging/Easy)
- **Level Verification**: Best Match locked until player completes 1 verification match or coach session
- **Game Formats**: Classic (best of 3), Simplified (2 sets), Rotation (partner swap every 15-20 min); auto-selected by level
- **Warm-up Protocol**: 10-min structured 4-phase warm-up with timer; required for C+ players
- **Stripe Payments**: Test mode payment flow (card: 4242 4242 4242 4242)
- **Video Analysis**: Upload videos for coach review with detailed metrics reports
- **Multi-language**: English, Russian (Русский), Arabic (عربي with RTL support)
- **Coach Dashboard**: Player verification, video queue management, upcoming matches
- **Admin Dashboard**: Real-time activity feed (auto-refresh 30s), revenue metrics, level distribution charts

## Auth

JWT stored in localStorage. Token decoded client-side for user/role data. Roles: `player`, `coach`, `admin`. Route guards redirect by role.

## Important Notes on Codegen

After editing `lib/api-spec/openapi.yaml`:
1. Run `cd lib/api-spec && npx orval --config ./orval.config.ts` (just orval, not the full script)
2. Overwrite `lib/api-zod/src/index.ts` to only contain `export * from "./generated/api";`
3. Run `pnpm run typecheck:libs`

This is because orval regenerates `src/index.ts` with stale references.
