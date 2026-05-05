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

- `users` — Players, coaches, admins. Includes `archetype` (text, nullable) and `warmUpPreference` (boolean, default false)
- `matches` — Match records with player lists, format, status, and scoring
- `bookings` — Match bookings with payment status and warm-up tracking
- `video_analyses` — Video submissions and AI analysis reports
- `activity_logs` — Real-time activity feed for admin dashboard
- `coaching_clients` — Coach Misha's real private clients (Oleg Ilin, Oleg Miserva, Yuri, Maxim)
- `coaching_sessions` — Lesson tracking with topics, drills, coach notes
- `post_match_notes` — Questions asked on court recorded by Misha
- `coaching_messages` — WhatsApp/in-app message history per client
- `recurring_schedules` — Fixed weekly slots (Oleg Miserva: Mon/Wed/Fri 09:30–10:30)
- `padel_rules` — Official padel rules in EN/RU/AR (10 rules across 5 categories)
- `padel_news` — News feed with categories: WPT news, coaching tips, student achievements

## Test Accounts

| Role   | Email                           | Password         |
|--------|---------------------------------|------------------|
| Misha  | admin (username)                | MISHA_JR9N3UZT   |
| Admin  | admin@padelconcierge.com        | admin123         |
| Coach  | coach@padelconcierge.com        | coach123         |
| Player | player@padelconcierge.com       | player123        |

## Coach Misha's Real Clients (Pre-loaded)

- **Oleg Ilin** — Level C, on-demand, 700 AED. 2 sessions: Forehand + Backhand/Off-Glass. Post-match Q&A recorded. WhatsApp history seeded.
- **Oleg Miserva** — Level C+, recurring Mon/Wed/Fri 09:30–10:30. Strongest client.
- **Yuri** — Level C, on-demand, 700 AED. Last contact Jan 22. Sample chat history.
- **Maxim** — Level C, on-demand. Unread incoming WhatsApp message seeded.

## Coach Pages (owner/coach/admin only)

- `/coach` — Misha's command center: today's sessions, stats, client cards, pending video queue
- `/clients` — Client list with search
- `/clients/new` — Add new coaching client (name, email, phone, level, booking pattern, price)
- `/clients/:id` — Full profile: sessions, post-match notes, chat history
- `/messages` — WhatsApp-style messaging hub with "Send Slots" shortcut
- `/rules` — Padel rules reference in RU/EN/AR
- `/news` — News feed; owners/coaches can post

## Feature Highlights

- **Archetype Quiz** (`/quiz`): 13 questions — 6 personality (Russian) → archetype + 7 tactics → level. Saves archetype + warmUpPreference to user profile. Archetypes: pro-ambitious, competitive-improver, balanced-competitor, social-enjoyer, casual-recreational. Shared utility: `artifacts/padel-concierge/src/lib/archetypes.ts`
- **Archetype Matchmaking**: `GET /api/users/find-matches?userId=X` — Priority 1: same archetype + skill ±2; Priority 2: skill ±3. Returns top 3.
- **Smart Match UI** (`/match-requests`): "Умный подбор" tab shows top 3 archetype-matched players with compatibility notes and warmup hints.
- **Lateness Billing**: `POST /api/bookings/lateness-split` — calculates payment splits (1% of court cost per minute late, redistributed to on-time players).
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

## Archetype System

5 archetypes computed from 6 binary questions. Scoring: Q1(analyze=1), Q2(win=1), Q3(push=1), Q4(new=1), Q5(pro=1). Q6(warmup) only affects `warmUpPreference`. Score≥4+isPro→pro-ambitious; Score≥4→competitive-improver; Score=3→balanced-competitor; Score≥2→social-enjoyer; else→casual-recreational. Saved via `POST /api/users/:id/archetype`. Shared utilities in `artifacts/padel-concierge/src/lib/archetypes.ts`.

## Important Notes on Codegen

After editing `lib/api-spec/openapi.yaml`:
1. Run `cd lib/api-spec && npx orval --config ./orval.config.ts` (just orval, not the full script)
2. Overwrite `lib/api-zod/src/index.ts` to only contain `export * from "./generated/api";`
3. Run `pnpm run typecheck:libs`

This is because orval regenerates `src/index.ts` with stale references.
