---
name: Recurring-training seed must roll past rows forward
description: Idempotent recurring seeds keyed by series id must advance stale past-dated rows, or seeded data never appears in the app.
---

The Mike group-trainings seed (`scripts/src/seed-mike-trainings.ts`) is idempotent
via `recurring_series_id`. The UPDATE branch originally only fixed level/coach/price
and left `date_time` untouched, so once a seeded occurrence fell into the past it
stayed there and never showed up in the app (lists filter out past trainings).

**Why:** "next occurrence" is only computed on INSERT; re-running never moved an
existing past row forward.

**How to apply:** in the UPDATE branch, if stored `date_time <= now()`, roll it to
the next future weekday/time occurrence and reset `status='open'`. Guard the move
with a boolean so legitimately future-dated rows (and their bookings) are untouched.
