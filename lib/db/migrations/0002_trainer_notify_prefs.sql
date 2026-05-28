-- Task #168: Per-channel notification preferences for trainer match requests.
-- This repo uses drizzle-kit push (no managed migrations folder), so this file
-- is intentionally kept as an idempotent reference script. Apply manually with:
--   psql "$DATABASE_URL" -f lib/db/migrations/0002_trainer_notify_prefs.sql
--
-- Safe to re-run.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_email_trainer_requests boolean NOT NULL DEFAULT TRUE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_whatsapp_trainer_requests boolean NOT NULL DEFAULT TRUE;

COMMIT;
