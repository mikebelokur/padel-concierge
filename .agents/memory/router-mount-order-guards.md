---
name: API router mount order vs root-level role guards
description: Why a player-accessible Express route can return 403 purely due to where its router is mounted in routes/index.ts
---

In `artifacts/api-server/src/routes/index.ts` all sub-routers are mounted at the same root via `router.use(subRouter)`. Several routers apply a root-level guard at their top with no path, e.g. `router.use(requireMode("coach","admin","developer"))` (coach.ts, coaching.ts, admin_user_profile.ts).

Because Express runs mounted routers in order, a request for a path handled by a LATER-mounted router still flows through every earlier router's top-level middleware first. If an earlier router has a root-level role guard, it will reject the request (403 Forbidden) before the later router ever runs.

**Symptom seen:** a brand-new player-accessible router mounted LAST returned 403 "Forbidden" on every route (even GETs), while existing player routes worked. `requireAuth` returns 401, never 403 — so a 403 on a route that only uses `requireAuth` means an upstream guarded router intercepted it.

**Why:** the new router was mounted after coach/coaching/admin_user_profile, whose root-level `requireMode(...)` guards run for all passing requests and 403 non-coach/non-admin users.

**How to apply:** Mount any player-accessible router BEFORE the routers that call `router.use(requireMode(...))` at their root (mount it early, e.g. right after matchesRouter). Routers that scope their guard per-route (e.g. `router.get(path, requireAdmin, ...)`) do NOT cause this, since the guard only runs when their own route matches.
