# Padel Concierge — Reframe End-of-Run Report

**Run window:** 2026-05-26 → 2026-05-28
**Compiled:** 2026-05-28 (Task #154, closing Part 6/7)
**Audience:** Misha

This report consolidates the seven parts of the reframe. Each section either summarizes the work or links to the canonical artifact produced earlier in the run.

---

## 1. Final route audit

Full table with status, tier visibility, and notes lives in **[`docs/route-audit.md`](./route-audit.md)** (Task #151).

Top-line counts from that audit:

| bucket                                    | count |
|-------------------------------------------|------:|
| Routes audited                            | 43    |
| `SHIPPED` (real data, ready)              | 38    |
| `PARTIAL` (works, needs polish/i18n)      | 4     |
| `DEV_ONLY` (must hide from players)       | 0     |
| Feature flags seeded (idempotent)         | 44    |
| └─ `min_tier=player` (incl. public)       | 31    |
| └─ `min_tier=coach`                       | 9     |
| └─ `min_tier=admin`                       | 4     |

The four `PARTIAL` routes (`/register`, `/bookings/:id`, `/match-requests`, `/clients/:id`) are visible to their respective tiers but flagged for follow-up (see §3).

---

## 2. Features now hidden from PLAYER mode

The IA restructure (#C) wired role gates via `allowedModes` in `artifacts/padel-concierge/src/App.tsx`. The following routes are no longer reachable from a `mode_player`-only account (verified against Veronika's account, `users.id = 47`):

- `/coach`, `/coach/group-trainings` — coach command center & session manager
- `/clients`, `/clients/new`, `/clients/:id` — legacy coach client list
- `/admin/clients/:userId` — unified client profile (canonical successor)
- `/messages` — coach WhatsApp hub
- `/match-log/:id` — score entry (coach/admin only)
- `/level-quiz/admin` — assessment review console
- `/registrations` — signup approval queue
- `/admin`, `/admin/users`, `/admin/coaching` — admin dashboards

Player-tier nav (Drawer in `App.tsx`) now exposes only: Training, Matches, Home, News & Tips, Profile, Padel Rules, Settings. Confirmed in the latest screenshot at `docs/polish-sweep/pwa-lighthouse.jpg`.

---

## 3. PARTIAL features visible to ADMIN / DEVELOPER (priority list)

Surfaces that work but still need design / copy / i18n attention. Ordered by Misha-impact:

| # | Route                | Why it is PARTIAL                                                              | Tier seeing it      | Suggested next step                                |
|---|----------------------|--------------------------------------------------------------------------------|---------------------|----------------------------------------------------|
| 1 | `/match-requests`    | 1,310 lines; "Умный подбор" tab is RU-only; mixed copy with EN sections.       | player + coach + admin | i18n pass + split into smaller components.       |
| 2 | `/register`          | 677 lines, 12 placeholder strings; optional fields unclear.                    | player + coach + admin | Shorten form; clarify optional vs required.     |
| 3 | `/bookings/:id`      | Stripe test-mode works; copy mixes EN/RU, empty states sparse.                 | player + coach + admin | Finish RU strings; design empty/error states.   |
| 4 | `/clients/:id`       | Functional but 1,282 lines and overlaps with `/admin/clients/:userId`.         | coach + admin       | Retire once unified profile is GA; remove from coach nav. |

(Already tracked in the open "Finish the visual polish across remaining player pages" task — no follow-up needed.)

---

## 4. Visual polish — before / after

The polish sweep (#D) captured one "after" screenshot per player-tier route. Files live in **[`docs/polish-sweep/`](./polish-sweep/)** — 23 JPEGs covering: home, login, register, forgot-password, reset-password, invite, dashboard, find-match, matches, match-requests, bookings, courts, members, assessment, level-quiz (+ result, profile), play, training, group-trainings, news, profile, rules, settings, video-analysis.

Headline changes applied across the sweep:
- Unified dark palette (`background_color: #0a0a0a`) and gold accent on primary CTAs.
- Drawer-based mobile-first nav with role-gated entries.
- Founding-member gold ribbon (Task #4) on member cards.
- Consistent empty/loading skeletons across list pages.

"Before" snapshots are not separately stored; the audit table in §1 implicitly captures the pre-polish status (`PARTIAL` rows are the deltas still outstanding).

---

## 5. Veronika invite

Full record, SQL proofs, and the persisted invite URL: **[`docs/veronika-invite.md`](./veronika-invite.md)**.

Quick reference:

```
https://23a57365-a8fd-47ff-af40-200fef47a201-00-165yfrh7giigy-cedc33ji.pike.replit.dev/invite/cf4ace51-cf80-4e81-9e68-1638efd8a781
```

- `users.id = 47` · `member_number = 1` · `badge = founding_member`
- Mode flags: `mode_player=true` (only) — pure player tier.
- Token valid until **2026-06-03 15:39 UTC**.

---

## 6. PWA Lighthouse — score + screenshot

### Audit setup
- **Target:** running preview at `localhost:80/` (proxied; same URL exposed via `$REPLIT_DEV_DOMAIN`).
- **Method:** Static installability audit against Chromium's `web_app_manifest` rules (Lighthouse v11 PWA category was retired in mid-2024, so we audit against the underlying installability criteria directly — `manifest.webmanifest`, service-worker registration, and meta tags).

### Installability checklist

| criterion                                            | status | evidence                                              |
|------------------------------------------------------|:------:|-------------------------------------------------------|
| Served over HTTPS (or localhost)                     |   ✅   | Replit proxy + production domain                      |
| `<link rel="manifest">` present                      |   ✅   | `artifacts/padel-concierge/index.html` line 29        |
| Manifest has `name` / `short_name`                   |   ✅   | "Padel Concierge" / "Padel"                           |
| Manifest has `start_url` inside `scope`              |   ✅   | both `/`                                              |
| Manifest has `display: standalone` (or fullscreen)   |   ✅   | `display: standalone`                                 |
| Manifest has `theme_color` matching `<meta>`         |   ✅   | both `#0a0a0a`                                        |
| 192×192 PNG icon with `purpose: any`                 |   ✅   | `icons/icon-192.png`                                  |
| 512×512 PNG icon with `purpose: any`                 |   ✅   | `icons/icon-512.png`                                  |
| Maskable icon present                                |   ✅   | duplicate 192 & 512 entries with `purpose: maskable` |
| Service worker registered with `fetch` handler       |   ✅   | `public/sw.js` registered from `main.tsx`             |
| Apple touch icon + `apple-mobile-web-app-capable`    |   ✅   | `index.html` lines 30–33                              |

### Fix applied during this task
Lighthouse warns when a single icon entry combines `purpose: "any maskable"` because maskable artwork is visually different from `any` artwork. The manifest was split into four explicit entries (192/512 × any/maskable) and the deprecated combined purpose removed. Also added `id: "/"` and `categories` for richer install metadata. No other installability blockers were found.

### Result
**Installable: PASS.** All Chromium installability criteria above are green. The Add-to-Home-Screen prompt is fired by `PWAInstallBanner.tsx` on the 2nd mobile visit; banner copy is bilingual (EN/RU) and dismissal is persisted in `localStorage` (`pwa_banner_dismissed`).

Screenshot of the audited page: **[`docs/polish-sweep/pwa-lighthouse.jpg`](./polish-sweep/pwa-lighthouse.jpg)**.

### Install-banner smoke test

| UA                                          | result                                                                 |
|---------------------------------------------|------------------------------------------------------------------------|
| iOS Safari (`iPhone; CPU iPhone OS 17_0`)   | Banner shows on 2nd visit; copy reads "Safari → Share → Add to Home Screen"; × dismisses and is persisted. |
| Android Chrome (`Linux; Android 14; Pixel`) | Banner shows on 2nd visit; copy reads "Chrome → menu (⋮) → Install app"; × dismisses and is persisted.    |
| Desktop Chrome                              | Banner correctly suppressed (mobile-only check in `PWAInstallBanner.tsx`).                                |
| Already-installed (standalone)              | Banner correctly suppressed via `matchMedia("(display-mode: standalone)")`.                               |

---

## 7. Blockers & open questions for Misha

**Blockers — none.** Every part of the reframe shipped to "usable" state.

**Open questions / decisions Misha should make next:**

1. **Retire `/clients/:id`?** The legacy 1,282-line coach client page duplicates `/admin/clients/:userId`. Recommendation: remove it from the coach nav and 301 to the unified profile. Needs Misha's sign-off because it changes muscle memory for the coach.
2. **`/match-requests` i18n.** The "Умный подбор" tab is currently RU-only. Confirm whether English copy is needed before the next cohort, or whether RU-only is fine while the user base is Russian-speaking.
3. **PWA icon.** Placeholder gold "P" passes installability but is not branded. Commission a final icon (1024px master, derived 192/512 + maskable safe-zone) when there is brand-asset budget. Not blocking install.
4. **Veronika invite expiry.** Token expires **2026-06-03 15:39 UTC**. If she has not redeemed by then, regenerate via `/admin/users` (or the SQL in `docs/veronika-invite.md`).
5. **Founding-member rollout.** Member #001 (Veronika) is live; #002–#020 invite slots are unallocated. Misha to provide the next batch of names + emails so the badge UI keeps its scarcity.
6. **Push notifications.** Out of scope this run. Worth a separate task if Misha wants match-confirmation pings.

---

*End of report.*
