---
name: API router mount order vs root-level role guards
description: Why a player-accessible Express route can return 403 purely due to where its router is mounted in routes/index.ts
---

In `artifacts/api-server/src/routes/index.ts` all sub-routers are mounted at the same root via `router.use(subRouter)`. Several routers apply a root-level guard at their top with no path, e.g. `router.use(requireMode("coach","admin","developer"))` (coach.ts, coaching.ts, admin_user_profile.ts).

Because Express runs mounted routers in order, a request for a path handled by a LATER-mounted router still flows through every earlier router's top-level middleware first. If an earlier router has a root-level role guard, it will reject the request (403 Forbidden) before the later router ever runs.

**Symptom seen:** a brand-new player-accessible router mounted LAST returned 403 "Forbidden" on every route (even GETs), while existing player routes worked. `requireAuth` returns 401, never 403 — so a 403 on a route that only uses `requireAuth` means an upstream guarded router intercepted it.

**Why:** the new router was mounted after coach/coaching/admin_user_profile, whose root-level `requireMode(...)` guards run for all passing requests and 403 non-coach/non-admin users.

**How to apply:** The root-cause fix (applied) is to mount the three root-`requireMode`-guarded routers (coachRouter, adminUserProfileRouter, coachingRouter) LAST in `routes/index.ts`, after every player/public router, so their guards never leak onto earlier routers. This is safe because those three only define `/coach/*`, `/coaching/*`, `/admin/users/:userId/*` paths — no player router shadows them. Routers that scope their guard per-route (e.g. `router.get(path, requireAdmin, ...)`) do NOT cause this, since the guard only runs when their own route matches.

**Side effect to know:** with the guards mounted last, a request to a path that matches NO route now falls through to a guarded router's `requireMode` and returns 403 (not 404) for non-coach/non-admin users. Cosmetic only.

**Verifying:** the `level_required.test.ts` / `invite_and_window.test.ts` mock-DB suite asserts players can reach matchmaking/match-requests/trainer-match-requests/find-matches; it goes from many 403 failures to green once the guards are mounted last. One pre-existing failure remains there (POST /admin/users) because `requireOwnerOrAdmin` in admin.ts does its own DB modes lookup the test's mock queue doesn't satisfy — unrelated to mount order.
