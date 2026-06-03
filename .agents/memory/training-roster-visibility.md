---
name: Training roster visibility gating
description: How the group-training roster endpoint's auth shapes client-side rendering.
---

The group-training roster endpoint returns the masked roster only when the caller
is a coach/admin, is actively booked, OR the training is open/full AND at/below
the player's level. Otherwise it returns 404 (not open/full) or 403 (above level).

**Why:** A naive client that always fetches and renders `roster ?? []` shows a
misleading "no one has signed up yet" for trainings the player simply cannot see,
and fires avoidable failing queries.

**How to apply:** On the player trainings page, only mount the roster fetch when
`isBooked || (!locked && status in {open,full})` and `!isPast`, and also bail out
on query error (`isError → render null`, `retry:false`). Keep this gate in lockstep
with the server's visibility rule if either side changes.
