-- Task #150: Backfill mode_* flags from legacy `role` column.
-- This repo uses drizzle-kit push (no managed migrations folder), so this file
-- is intentionally kept as an idempotent reference script. Apply manually with:
--   psql "$DATABASE_URL" -f lib/db/migrations/0001_mode_flags_backfill.sql
--
-- It is safe to re-run: all updates are idempotent boolean assignments.

BEGIN;

-- Everyone is a player by default.
UPDATE users
SET mode_player = TRUE
WHERE mode_player IS DISTINCT FROM TRUE;

-- Legacy admin/owner roles → admin mode.
UPDATE users
SET mode_admin = TRUE
WHERE role IN ('admin', 'owner')
  AND mode_admin IS DISTINCT FROM TRUE;

-- Legacy coach role → coach mode.
UPDATE users
SET mode_coach = TRUE
WHERE role = 'coach'
  AND mode_coach IS DISTINCT FROM TRUE;

-- Bootstrap owner: grant all four modes (player, coach, admin, developer).
UPDATE users
SET mode_player    = TRUE,
    mode_coach     = TRUE,
    mode_admin     = TRUE,
    mode_developer = TRUE
WHERE email = 'mikebelokur8@gmail.com';

COMMIT;
