-- Task #169: Translatable activity feed entries.
-- Adds a jsonb column for the language-neutral params that drive i18n
-- rendering on clients. The legacy English `details` column stays as a
-- fallback for already-stored rows.
--
-- Apply manually with:
--   psql "$DATABASE_URL" -f lib/db/migrations/0003_activity_log_params.sql
--
-- Safe to re-run.

BEGIN;

ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS details_params jsonb;

COMMIT;
