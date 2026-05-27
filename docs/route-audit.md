# Route Audit — Padel Concierge (Task #151)

**Date:** 2026-05-27
**Source:** `artifacts/padel-concierge/src/App.tsx` (every `<Route>`) + `pages/*.tsx`.
**Method:** Static + functional pass on the running preview (admin login). Pages were classified by reading the component, the API hooks it consumes, and a click-through of the rendered preview where reachable. Statuses are conservative — anything with mock/stub data or visibly half-finished UI is downgraded to PARTIAL or DEV_ONLY.

**Status legend**
- `SHIPPED` — wired end-to-end, real data, safe for the listed tier in production.
- `PARTIAL` — works for the happy path but has placeholder copy, English/Russian mix, dead controls, or missing states. Usable internally, not polish-ready.
- `DEV_ONLY` — broken, experimental, or only valid for staff/QA; must not be exposed to players.

**Tier columns** (✅ = should see, ❌ = should not, — = N/A). `player` = mode_player only, `coach` = mode_coach, `admin` = mode_admin (includes owner + developer for visibility purposes).

| route                          | status   | player | coach | admin | notes |
|--------------------------------|----------|--------|-------|-------|-------|
| `/`                            | SHIPPED  | ✅     | ✅    | ✅    | Public landing (`home.tsx`, 87 lines). Marketing copy, EN/RU. |
| `/login`                       | SHIPPED  | ✅     | ✅    | ✅    | Public. Missing `autocomplete="current-password"` (console warning, non-blocking). |
| `/register`                    | PARTIAL  | ✅     | ✅    | ✅    | 677 lines, 12 TODO/placeholder hits. Long form, several optional fields unclear. Works for self-signup. |
| `/forgot-password`             | SHIPPED  | ✅     | ✅    | ✅    | Public. |
| `/reset-password`              | SHIPPED  | ✅     | ✅    | ✅    | Public. Token-driven. |
| `/invite/:token`               | SHIPPED  | ✅     | ✅    | ✅    | Public. Veronika #001 invite verified working (see `docs/veronika-invite.md`). |
| `/dashboard`                   | SHIPPED  | ✅     | ✅    | ✅    | Mode-aware home (409 lines). Hits real APIs. |
| `/find-match`                  | SHIPPED  | ✅     | ✅    | ✅    | Smart matchmaking UI (612 lines). Real data. |
| `/matches`                     | SHIPPED  | ✅     | ✅    | ✅    | List of matches. |
| `/matches/suggest`             | SHIPPED  | ✅     | ✅    | ✅    | Suggestion flow. |
| `/matches/:id`                 | SHIPPED  | ✅     | ✅    | ✅    | Match detail with scores. |
| `/bookings`                    | SHIPPED  | ✅     | ✅    | ✅    | Real bookings list. |
| `/bookings/:id`                | PARTIAL  | ✅     | ✅    | ✅    | Stripe test-mode payment flow present but copy mixes EN/RU; some empty states sparse. |
| `/courts`                      | SHIPPED  | ✅     | ✅    | ✅    | Court directory (242 lines). |
| `/members`                     | SHIPPED  | ✅     | ✅    | ✅    | Member directory with search (547 lines). |
| `/players/:id`                 | SHIPPED  | ✅     | ✅    | ✅    | Player public profile (432 lines). |
| `/match-requests`              | PARTIAL  | ✅     | ✅    | ✅    | 1310 lines incl. archetype "Умный подбор" tab. Russian-only copy in spots, long file — polish needed for player tier. |
| `/match-log/:id`               | SHIPPED  | ❌     | ✅    | ✅    | Coach/admin only (already gated by `allowedModes`). Score + notes entry. |
| `/match-feedback/:id`          | SHIPPED  | ✅     | ✅    | ✅    | Anonymous peer feedback form. |
| `/assessment`                  | SHIPPED  | ✅     | ✅    | ✅    | Self-assessment intake. |
| `/quiz`                        | SHIPPED  | ✅     | ✅    | ✅    | Archetype quiz (530 lines, RU). |
| `/level-quiz`                  | SHIPPED  | ✅     | ✅    | ✅    | Public; no auth required. |
| `/level-quiz/result`           | SHIPPED  | ✅     | ✅    | ✅    | Public result page. |
| `/level-quiz/profile`          | SHIPPED  | ✅     | ✅    | ✅    | Public profile capture. |
| `/level-quiz/admin`            | SHIPPED  | ❌     | ✅    | ✅    | Gated to coach/admin/developer. |
| `/clients`                     | SHIPPED  | ❌     | ✅    | ✅    | Coach client list (gated). |
| `/clients/new`                 | SHIPPED  | ❌     | ✅    | ✅    | New coaching client form. |
| `/clients/:id`                 | PARTIAL  | ❌     | ✅    | ✅    | 1282 lines, 16 placeholder hits. Functional but giant — overlaps with new `/admin/clients/:userId`. Candidate for retirement once T#1 unified profile is GA. |
| `/messages`                    | SHIPPED  | ❌     | ✅    | ✅    | WhatsApp-style messaging hub. |
| `/rules`                       | SHIPPED  | ✅     | ✅    | ✅    | Padel rules reference (EN/RU/AR). |
| `/news`                        | SHIPPED  | ✅     | ✅    | ✅    | News feed; post-write gated to coach/owner. |
| `/profile`                     | SHIPPED  | ✅     | ✅    | ✅    | User profile editor (562 lines). |
| `/settings`                    | SHIPPED  | ✅     | ✅    | ✅    | Account settings. |
| `/video-analysis`              | SHIPPED  | ✅     | ✅    | ✅    | Video list. |
| `/video-analysis/:id`          | SHIPPED  | ✅     | ✅    | ✅    | Video detail + AI report. |
| `/group-trainings`             | SHIPPED  | ✅     | ✅    | ✅    | Player-facing group training browse + booking (1262 lines, lazy-loaded). |
| `/coach/group-trainings`       | SHIPPED  | ❌     | ✅    | ✅    | Coach session manager (876 lines). |
| `/coach`                       | SHIPPED  | ❌     | ✅    | ✅    | Coach command center. |
| `/registrations`               | SHIPPED  | ❌     | ❌    | ✅    | Admin/developer signup queue. |
| `/admin`                       | SHIPPED  | ❌     | ❌    | ✅    | Admin dashboard (916 lines). |
| `/admin/users`                 | SHIPPED  | ❌     | ❌    | ✅    | User management with founding-member pills (481 lines). |
| `/admin/clients/:userId`       | SHIPPED  | ❌     | ✅    | ✅    | Unified client profile (Task #1). Replaces `/clients/:id` long-term. |
| `/admin/coaching`              | SHIPPED  | ❌     | ❌    | ✅    | Redirect → `/admin/users`. |
| *(catch-all)* 404              | SHIPPED  | ✅     | ✅    | ✅    | `not-found.tsx`. |

## Veronika (Member #001) mode-flag confirmation

Per Task #151 acceptance, confirmed via SQL on 2026-05-27:

```sql
SELECT id, name, role, mode_player, mode_coach, mode_admin, mode_developer
FROM users WHERE id = 47;
-- → 47 | Veronika | player | t | f | f | f
```

Full invite details and persisted URL: see `docs/veronika-invite.md`.

## feature_flags seeding proof

Seeded via `pnpm --filter @workspace/scripts run seed-feature-flags`
(idempotent upsert; script at `scripts/src/seed-feature-flags.ts`,
aligned with canonical schema `lib/db/src/schema/feature_flags.ts`:
`name PK | min_tier | status`).

```
by min_tier:
  admin      4
  coach      9
  player    31
by status:
  partial    4
  shipped   40
```

Sample query:
```sql
SELECT name, min_tier, status FROM feature_flags
WHERE status = 'partial' ORDER BY name;
-- /bookings/:id   | player | partial
-- /clients/:id    | coach  | partial
-- /match-requests | player | partial
-- /register       | player | partial
```

Note: the canonical schema's `min_tier` constraint only allows
`player|coach|admin|developer`. Truly public routes (landing, login,
register, invite, level-quiz, 404) are stored as `min_tier='player'`
(lowest authenticated tier) with `notes` prefixed `public:` so the IA
restructure (#C) can identify them.

## Cross-cutting notes

- **Language mix:** `match-requests`, `quiz`, `level-quiz`, and parts of `find-match` are RU-only — fine for the current Dubai/Russian-speaking cohort but flag for the polish sweep (#D).
- **Dead buttons:** none surfaced during the walk-through. The `find-match.tsx` dialog uses a placeholder for textarea hint only (not a dead control).
- **Layout breakage:** `/dashboard` rendering when unauthenticated leaves the Drawer mounted next to the login form (preview screenshot). Cosmetic; the redirect itself works.
- **Duplicates:** `/clients/:id` (coach view, 1282 lines) and `/admin/clients/:userId` (new unified profile, 228 lines) overlap. Plan: keep `/admin/clients/:userId` as canonical, retire `/clients/:id` in IA restructure (#C).
- **PWA:** routes are SPA-routed under base path; manifest + SW already in place (Task #7 overnight).

## Summary lists

### Safe to expose to PLAYER mode
`/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/invite/:token`, `/dashboard`, `/find-match`, `/matches`, `/matches/suggest`, `/matches/:id`, `/bookings`, `/bookings/:id`, `/courts`, `/members`, `/players/:id`, `/match-requests`, `/match-feedback/:id`, `/assessment`, `/quiz`, `/level-quiz`, `/level-quiz/result`, `/level-quiz/profile`, `/rules`, `/news`, `/profile`, `/settings`, `/video-analysis`, `/video-analysis/:id`, `/group-trainings`.

### Should be ADMIN-only (currently visible to players)
None. Coach/admin pages already use `allowedModes` gating in `App.tsx`. The audit confirmed `/clients*`, `/messages`, `/match-log/:id`, `/coach`, `/coach/group-trainings`, `/level-quiz/admin`, `/admin`, `/admin/users`, `/admin/clients/:userId`, `/admin/coaching`, `/registrations` are all role-gated.

### Should be DEV_ONLY (broken or experimental)
None today. `/clients/:id` is flagged for retirement (PARTIAL, duplicates `/admin/clients/:userId`) but is not broken. IA restructure (#C) should hide it from the coach nav once the unified profile is GA.
