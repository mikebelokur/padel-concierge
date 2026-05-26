# Schema Status — 2026-05-26

Tracks drift between the Drizzle schema (`lib/db/src/schema/`) and the live
PostgreSQL database. Updated whenever schema changes are pushed manually via
SQL or `drizzle-kit push`.

## Source of truth

- **Drizzle schema** — `lib/db/src/schema/*.ts` (TypeScript)
- **Live DB** — Replit-managed PostgreSQL (`DATABASE_URL`)

When the two disagree, the Drizzle schema is authoritative for application
code, but the live DB is authoritative for runtime behaviour. Any drift listed
below must be reconciled before production cutover.

## Known drift (as of 2026-05-26)

### In live DB but not in Drizzle schema

| Table | Origin | Plan |
|---|---|---|
| `pf_users` | Padel Future lead-capture mini-app | Keep as-is; add Drizzle schema file `lib/db/src/schema/padel_future.ts` so types stop drifting. |
| `pf_quiz_results` | Padel Future quiz results | Keep as-is; add to same Drizzle schema file. |
| `court_bookings` | Legacy court CRUD (`courts.ts` route) | Schema file exists at `lib/db/src/schema/courts.ts` — verify columns match live DB; no action expected. |

### In Drizzle schema but not in live DB

| Table | Origin | Plan |
|---|---|---|
| `player_profiles` | Drafted for new richer player schema | Decision pending. Currently blocks `drizzle-kit push` with interactive rename prompt against `pf_users`. Either remove from schema (recommended for live launch) or run `drizzle-kit push --force` once we are sure no rename is intended. |
| `match_logs` | Drafted analytics table | Not in use. Remove from `lib/db/src/schema/` until analytics work resumes. |
| `compatibility_scores` | Drafted matchmaking cache | Not in use. Remove from schema. |
| `feedback_aggregates` | Drafted analytics aggregate | Not in use. Remove from schema. |

> The four drafted tables above are why `pnpm --filter @workspace/db run push`
> opens an interactive prompt and stalls the post-merge script. As soon as
> they are removed (or pushed for real), `push` becomes non-interactive again.

## Tue/Thu group-training launch — schema additions applied

These were applied manually via SQL on 2026-05-26 and added to the Drizzle
schema in the same commit:

### `users` (Task A — member identity)

```sql
ALTER TABLE users
  ADD COLUMN source text DEFAULT 'self_signup' NOT NULL,
  ADD COLUMN member_number integer,
  ADD COLUMN badge text,
  ADD COLUMN invite_status text DEFAULT 'not_invited' NOT NULL,
  ADD COLUMN invite_token uuid,
  ADD COLUMN invite_token_expires_at timestamptz;

ALTER TABLE users
  ADD CONSTRAINT users_source_check
    CHECK (source IN ('self_signup','coach_added'));

ALTER TABLE users
  ADD CONSTRAINT users_invite_status_check
    CHECK (invite_status IN ('not_invited','invited','activated','declined'));

CREATE SEQUENCE IF NOT EXISTS users_member_number_seq;
CREATE UNIQUE INDEX users_member_number_unique ON users(member_number);
CREATE UNIQUE INDEX users_invite_token_unique  ON users(invite_token) WHERE invite_token IS NOT NULL;
```

Backfilled `member_number` 1–17 via `row_number() OVER (ORDER BY created_at)`.
Token TTL: **7 days** (set in `routes/invite.ts → generateInviteToken()`); update here if policy changes.

> ⚠️ These ALTERs were applied manually via raw SQL on 2026-05-26 because
> `drizzle-kit push` blocks on the unrelated `player_profiles` rename prompt.
> Once the drafted tables (see drift section above) are removed, regenerate a
> migration with `drizzle-kit generate` so the change is reproducible.

### `group_trainings` (Task C — registration window)

```sql
ALTER TABLE group_trainings DROP CONSTRAINT IF EXISTS group_trainings_status_check;
ALTER TABLE group_trainings ADD  CONSTRAINT group_trainings_status_check
  CHECK (status IN ('scheduled','open','closed','full','cancelled','completed'));
ALTER TABLE group_trainings ALTER COLUMN status SET DEFAULT 'scheduled';
```

Lifecycle (managed in `artifacts/api-server/src/lib/groupTrainingScheduler.ts`):

- New instance generated → `scheduled`
- T-48h before `date_time` → `scheduled` → `open` (triggers session-open emails, 12h cooldown)
- T-12h before `date_time` → `open` → `closed`
- Last spot booked → `open`/`full` (existing logic, untouched)

## Verification queries

```sql
-- Drift checklist
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' ORDER BY table_name;

-- group_trainings status distribution
SELECT status, count(*) FROM group_trainings GROUP BY status ORDER BY status;

-- users identity backfill
SELECT count(*) FILTER (WHERE member_number IS NULL) AS missing_member_number,
       count(*) FILTER (WHERE source IS NULL)        AS missing_source,
       count(*) FILTER (WHERE invite_status IS NULL) AS missing_invite_status
  FROM users;
```

## Next steps before launch

1. Remove unused drafted tables from `lib/db/src/schema/` (`match_logs`, `compatibility_scores`, `feedback_aggregates`, and `player_profiles` if abandoned).
2. Add `pf_users` and `pf_quiz_results` Drizzle definitions so `drizzle-kit pull` produces a clean diff.
3. Confirm post-merge script can run `drizzle-kit push` non-interactively.
4. Seed 4 `recurring_series` rows for Tue/Thu trainings (operator action; not in code).
