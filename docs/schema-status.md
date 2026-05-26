# Schema Status — 2026-05-26 (Final)

Tracks drift between the Drizzle schema (`lib/db/src/schema/`) and the live
PostgreSQL database. Updated whenever schema changes are pushed manually via
SQL or `drizzle-kit push`.

## Source of truth

- **Drizzle schema** — `lib/db/src/schema/*.ts` (TypeScript)
- **Live DB** — Replit-managed PostgreSQL (`DATABASE_URL`)

## Current status: ✅ ZERO DRIFT

All schema files reconcile cleanly with the live DB. `pnpm --filter
@workspace/db run push` completes non-interactively with "Changes applied" and
no prompts.

## Reconciliation actions taken 2026-05-26

| Table.Column | Action |
|---|---|
| `users.reminder_sent_at` | Added to live DB via `ALTER TABLE` (was causing 500 on every `/api/auth/login`). |
| `users.reminder_opt_out` | Added to live DB via `ALTER TABLE`. |
| `reminder_logs` (table) | Created in live DB to match Drizzle schema; used by reminder job + admin "remind all". |
| `matches.conflict_occurred` | Drizzle schema changed `text("false"/"true")` → `boolean(false)`. Route handlers in `artifacts/api-server/src/routes/matches.ts` updated (3 sites) to read/write a real boolean instead of stringifying. Live column was already `boolean` — schema now matches. |
| `match_requests.match_id` | Added to live DB (`integer REFERENCES matches(id) ON DELETE SET NULL`). Drizzle schema already declared it. |
| `player_profiles` | Created in live DB (kept dormant). Activated later in v2 with FIFA-style cards. |
| `match_logs` | Created in live DB (kept dormant). Behavioral.ts upserts into it on match create/update via `fireAndForget`. |
| `feedback_aggregates` | Created in live DB (kept dormant). Used by behavioral analytics in v2. |
| `compatibility_scores` | Created in live DB (kept dormant). Used by vibe matching in v2. |
| `pf_users` | New Drizzle schema file `lib/db/src/schema/pf_users.ts` mirrors live columns. |
| `pf_quiz_results` | New Drizzle schema file `lib/db/src/schema/pf_quiz_results.ts` mirrors live columns. |

## Verification

- `pnpm --filter @workspace/db run push` → `[✓] Changes applied` (no prompts).
- `pnpm run typecheck` → all runtime artifacts (api-server, padel-concierge,
  padel-future, mobile, scripts) pass. Only `mockup-sandbox` shows pre-existing
  React 19 type mismatch in `calendar.tsx`/`spinner.tsx` (unrelated).
- Smoke tests:
  - `POST /api/auth/login` → 200 (admin@padelconcierge.com / admin123)
  - `GET /api/group-trainings` → 200
  - `GET /api/admin/users` → 200
  - `GET /api/admin/incomplete-profiles` → 200
  - `GET /api/match-requests?userId=38` → 200
  - `GET /api/matches` → 200

## Live tables (30)

activity_logs, bookings, coaching_clients, coaching_messages,
coaching_sessions, compatibility_scores, court_bookings, courts,
feedback_aggregates, group_trainings, match_feedback, match_logs,
match_requests, matches, notifications, padel_news, padel_rules,
password_reset_tokens, pf_quiz_results, pf_users, player_profiles,
post_match_notes, recurring_schedules, recurring_series, reminder_logs,
skill_assessments, trainer_match_requests, training_bookings, users,
video_analyses.
