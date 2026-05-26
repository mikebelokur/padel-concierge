# Padel Concierge — Project Audit

**Date:** 2026-05-26
**Scope:** Read-only audit. No code modified.
**Repo state:** HEAD `ce91a19` (Task #135 reminder cooldown).

---

## Section 1 — Completed tasks inventory

Source: `.local/tasks/*.md` (31 plan files), git log, and merged-task checkpoints. Status "Done" = task spec exists *and* code has shipped on `main`. Dates are from the corresponding commit (UTC).

### Authentication & user management

| # | Task title | Date completed | Brief description | Files / routes / tables touched |
|---|---|---|---|---|
| 24 | Seed standard test accounts | early | Pre-create admin / coach / player / Misha demo logins | `users`, seed scripts |
| 25 | Open full profile from Members row | early | Member rows on `/members` link to the profile page | `members.tsx`, `users.ts` route |
| 26 | Full searchable member roster | early | Coach-facing roster with search | `members.tsx`, `GET /users` |
| 34 | Apply missing `behavioral_override` migration | early | Fixed registration 500 caused by missing column | `users` table, migration |
| 43 | Bulk-verify action on Full Roster | early | One-click verify multiple players | `members.tsx`, `POST /users/:id/verify` |
| 115 | Group Trainings #1 — User segmentation | 2026-05-25 (`0682cf1`/`6aa5d67`) | Split users into real / test / pf via `user_type` column | `users.user_type`, `/admin/users?userType=` |
| — | Admin panel for Padel Future at `/admin` | 2026-05-25 | User-management surface for pf users | `admin.tsx`, `padel_future.ts` |

### Onboarding & level assessment (quiz)

| # | Task title | Date completed | Brief description | Files / routes / tables touched |
|---|---|---|---|---|
| 38 | Seed 8 matchmaking test users (new schema) | early | Realistic users for matchmaking demo | `users`, seeders |
| 39 | Show new player fields on profile/members | early | Surface level / physical / warmup-style | `profile.tsx`, `members.tsx` |
| — | Fix onboarding re-registration bug + RU error UX | early | Friendly Russian errors during signup | `auth.tsx`, `errorMessages.ts` |
| 107 | Dashboard incomplete-profile banner | 2026-05-25 (`83ef8ab`) | Warn users without level on dashboard | `dashboard.tsx`, `users.archetype` |
| — | Archetype quiz (13 Q) | earlier | 6 personality + 7 tactical → archetype + level | `quiz.tsx`, `archetypes.ts`, `POST /users/:id/archetype` |

### Matchmaking & player visibility

| # | Task title | Date completed | Brief description | Files / routes / tables touched |
|---|---|---|---|---|
| 57 | Date+time when suggesting a match | earlier | Adds proposed date/time fields on match request | `match-requests.tsx`, `match_requests` table |
| 71 | Notification dot on Requests tab (mobile) | earlier | Unread badge in bottom nav | `BottomNav.tsx`, `/match-requests/pending-count` |
| 78 | Coach session notes + client progress charts | earlier | Charts and notes in client profile | `clients/:id.tsx`, `coaching_sessions` |
| 116 | Group Trainings #2 — DB schema + API | 2026-05-25 (`061fe1b`…`d367be4`) | UUID schemas + OpenAPI contract | `group_trainings`, `training_bookings`, `recurring_series` |
| 117 | Group Trainings #3 — Coach admin page | 2026-05-25 (`d0ab0cd`…`9f52d39`) | Coach can create / edit / delete sessions | `coach-group-trainings.tsx`, `/group-trainings` routes |
| 118 | Group Trainings #4 — Player view + booking | 2026-05-25 (`aa636b7`…`875e6c2`) | Players browse and book sessions | `group-trainings.tsx`, `POST /group-trainings/:id/book` |
| 119 | Group Trainings #5 — Recurring + notifications | 2026-05-25 (`ac07c05`) | Recurring generator + in-app notifications | `recurring_series`, `notifications`, `groupTrainingScheduler.ts` |
| 120 | Group Trainings #6 — Counter + polish | 2026-05-26 (`d12a829`) | Public participant counter on homepage | `home.tsx`, `/stats/participants` |
| 131 | Block matchmaking server-side when no level | 2026-05-26 (`a5b260c`) | 400 LEVEL_REQUIRED across 4 endpoints | `matchmaking.ts`, `match_requests.ts`, `trainer_match_requests.ts`, `users.ts` |
| 132 | No-level nudge banner in `AppLayout` | 2026-05-26 (`4a9f486`) | Persistent strip on every page until level set | `AppLayout.tsx` |
| — | Level-required guard for find-match + match-request | 2026-05-26 (`74ad7f4`) | Same idea, earlier pass | `users.ts`, `match_requests.ts` |

### Admin tools & reminders

| # | Task title | Date completed | Brief description | Files / routes / tables touched |
|---|---|---|---|---|
| — | One-time setup reminder email | 2026-05-25 (`8570f9e`) | Send Resend email to players missing profile | `reminderJob.ts`, `mail.ts`, `users.reminderSentAt` |
| — | Configure sender email + APP_URL for prod | 2026-05-26 (`68d05a4`) | Wire `EMAIL_FROM` + `APP_URL` from env / `REPLIT_DOMAINS` | `mail.ts` |
| 121 | Incomplete-profile admin view | 2026-05-26 (`d3c4283`) | New tab listing players w/o level + per-row remind button | `admin.tsx`, `GET /admin/incomplete-profiles` |
| 128 | Reminder history log per player | 2026-05-26 (`a418509`) | Each send is recorded, expandable history UI | `reminder_logs` table, `admin.tsx` |
| 129 | Bulk "Напомнить всем" | 2026-05-26 (`b1f6085`) | One-click bulk reminder for incomplete profiles | `POST /admin/incomplete-profiles/remind-all` |
| 135 | Per-player cooldown + cap | 2026-05-26 (`ce91a19`) | 48h cooldown, 5-send hard cap, 429 on manual block | `reminderJob.ts`, `admin.ts`, `admin.tsx` |

### Translations & UI polish

| # | Task title | Date completed | Brief description | Files / routes / tables touched |
|---|---|---|---|---|
| 85 | Fix hardcoded English on `/matches` | earlier | Russian/Arabic strings via i18n | `matches.tsx`, `translations.ts` |
| 109 | Translate remaining English in coach pages | 2026-05-26 (`619e484`) | Coach UI sweep | `coach.tsx`, `coach-messages.tsx`, `clients.tsx` |
| 125 | Translate coach group-trainings page to RU | 2026-05-26 (`78d97ea`) | i18n keys for `coachTrainings.*` | `coach-group-trainings.tsx` |
| 126 | Translate video-analysis pages to RU | 2026-05-26 (`550c3b7`) | Player + coach video views | `video-analysis.tsx`, `coach-video.tsx` |
| — | Client-profile English → Russian sweep | 2026-05-26 (`59ad551`) | Residual labels in `client-profile.tsx` | `client-profile.tsx` |
| 134 | Final coach-pages English sweep | 2026-05-26 (`2abaddc`) | Booking-pattern, video pill, RU date locale | `clients.tsx`, `coach.tsx`, `coach-messages.tsx` |
| — | iOS-style mobile redesign | earlier | Bottom nav, sheets, mobile polish | mobile UI components |

### Infrastructure & misc

| # | Task title | Date completed | Brief description | Files / routes / tables touched |
|---|---|---|---|---|
| 108 | Fix pre-existing TS errors in UI components | 2026-05-25 (`2c043ed`) | Unblocks typecheck | UI components |
| — | Homepage participant counter + routing fix | 2026-05-26 (`d12a829`) | Public `/stats/participants` + route order fix | `stats.ts`, `App.tsx` |
| — | MongoDB analytics layer | scaffolded | `lib/mongo` package (client / collections / types) — not wired into the API server | `lib/mongo/*` |
| — | Padel Future quiz + admin (`pf_users`, `pf_quiz_results`) | earlier | Lead-capture mini-app under `/pf/*` | `padel_future.ts`, `pf_users`, `pf_quiz_results` |
| — | Court bookings (legacy) | earlier | Court CRUD + bookings table (`court_bookings`) | `courts.ts`, `court_bookings` |

---

## Section 2 — Current database schema

25 tables in `public`. Row counts captured at audit time via `SELECT count(*)`. PostgreSQL does not record per-table last-modified timestamps; the "Last modified (proxy)" column uses the newest `created_at`/`updated_at`/equivalent column in the table where one exists, otherwise "—".

> ⚠️ **Schema drift detected** — compare against `lib/db/src/schema/`:
> - In DB but not in Drizzle schema dir: `pf_users`, `pf_quiz_results`, `court_bookings`.
> - In Drizzle schema dir but not in DB: `player_profiles`, `match_logs`, `compatibility_scores`, `feedback_aggregates`. (`drizzle-kit push` keeps blocking on an interactive "is `player_profiles` created or renamed from `pf_users`/`pf_quiz_results`?" prompt — post-merge script can't answer it.)

### `users` — 17 rows
| Column | Type | Nullable | Default |
|---|---|---|---|
| id | integer (PK, serial) | NO | |
| name | text | NO | |
| email | text | NO | |
| phone | text | NO | |
| password_hash | text | NO | |
| level | text | NO | `'D'` |
| goal | text | NO | `'Play'` |
| intensity | text | NO | `'Active-Dynamic'` |
| location_lat / location_lng | real | YES | |
| location_name | text | YES | |
| avatar | text | YES | |
| verified | boolean | NO | false |
| verification_date | timestamptz | YES | |
| role | text | NO | `'player'` |
| favourite_players | text[] | NO | `{}` |
| availability | text (JSON) | NO | `'[]'` |
| matches_played | integer | NO | 0 |
| wins | integer | NO | 0 |
| language | text | NO | `'en'` |
| is_online | boolean | NO | false |
| last_active | timestamptz | YES | |
| created_at | timestamptz | NO | now() |
| last_login | timestamptz | YES | |
| approval_status | text | NO | `'approved'` |
| approved_at / approved_by | timestamptz / text | YES | |
| archetype | text | YES | |
| warm_up_preference | boolean | NO | false |
| behavioral_override | text | YES | |
| level_self | real | YES | |
| level_quiz | text | YES | |
| physical_self | integer | YES | |
| warmup_format | text | YES | |
| user_type | text | NO | `'real_user'` |

FKs: none.

### `activity_logs` — 93 rows
id (PK serial), user_id int, user_name text, action text, details text?, created_at timestamptz.
FKs: none (logical only).

### `bookings` — 0 rows
id (PK), user_id int, match_id int, payment_status text='pending', payment_id text?, warm_up_completed bool=false, cancelled_at timestamptz?, created_at timestamptz. FKs: none declared.

### `coaching_clients` — 4 rows
id (PK), name, phone, email, level='C', booking_pattern='on_demand', price_per_session=700, status='active', notes, avatar_initials, total_sessions, total_revenue, last_session_date, next_session_date, next_session_plan, tags text[], package_type='per_session', sessions_in_package, sessions_used, behavioral_override?, created_at. FKs: none.

### `coaching_messages` — 15 rows
id (PK), client_id int, direction text='in', content, channel='whatsapp', read bool, sent_at.
FK: `client_id → coaching_clients(id)`.

### `coaching_sessions` — 2 rows
id, client_id int, session_number, topic, subtopics text[], date text, time text, duration_minutes=60, court, status='completed', coach_notes, drills_covered text[], next_session_focus, created_at.
FK: `client_id → coaching_clients(id)`.

### `court_bookings` — 7 rows  *(in DB, not in Drizzle schema dir)*
id, user_id int, court_id int, date text, start_time text, end_time text, status='confirmed', total_price real, created_at, cancelled_at?. FKs: none declared.

### `courts` — 5 rows
id, name, location, address, price_per_hour=120, amenities text(JSON), surface='clay', indoor bool=false, image_url?, available_slots text(JSON), created_at. FKs: none.

### `group_trainings` — 4 rows
id uuid (PK, gen_random_uuid), coach_id int, date_time timestamptz, duration_minutes=90, category text, court_name text, court_address?, max_participants=4, price_aed numeric, description_en?, description_ru?, status='open', is_recurring bool=false, recurring_series_id uuid?, recurring_pattern?, created_at, updated_at.
FK: `coach_id → users(id)`.

### `match_feedback` — 0 rows
id, match_id int, about_user_id int, rating=5, traits text[], comment, created_at. FKs: none declared.

### `match_requests` — 0 rows
id, from_user_id int, to_user_id int, message?, status='pending', proposed_date text?, proposed_time text?, created_at, updated_at. FKs: none declared.

### `matches` — 7 rows
id, date text, time text, club_name text, format='Simplified', players text(JSON), status='suggested', price=120, level_min?, level_max?, match_type='balanced', balance_score?, created_at, set_scores text, player_ratings text(JSON), conflict_occurred bool, overall_note text. FKs: none.

### `notifications` — 19 rows
id uuid, user_id int, kind text, training_id uuid?, title_en, title_ru, body_en, body_ru, link?, read_at timestamptz?, created_at.
FK: `user_id → users(id)`.

### `padel_news` — 5 rows
id, title, content, category='global_news', author='Misha', image_url?, published bool=true, created_at. FKs: none.

### `padel_rules` — 10 rows
id, category, title_en/ru/ar, rule_en/ru/ar, keywords text[], sort_order text='0', created_at. FKs: none.

### `password_reset_tokens` — 1 row
id, user_id int, token text, expires_at timestamptz, created_at.
FK: `user_id → users(id)`.

### `pf_users` — 1 row  *(Padel Future lead capture; not in Drizzle schema dir)*
id, name varchar, email varchar, phone varchar?, created_at timestamp. FKs: none.

### `pf_quiz_results` — 1 row  *(Padel Future quiz; not in Drizzle schema dir)*
id, user_id int?, quiz_level varchar?, real_level varchar?, q1..q3 int, q4_answer varchar + q4_extra text, q5..q10 varchar, personality_type varchar?, completed_at timestamp default now, session_id text?.
FK: `user_id → pf_users(id)`.

### `post_match_notes` — 4 rows
id, client_id int, session_id int?, question text, coach_response text, category='technique', recorded_at.
FKs: `client_id → coaching_clients(id)`, `session_id → coaching_sessions(id)`.

### `recurring_schedules` — 3 rows  *(coaching client weekly slots)*
id, client_id int, day_of_week int, start_time text, end_time text, court text, active bool=true, created_at.
FK: `client_id → coaching_clients(id)`.

### `recurring_series` — 0 rows  *(group-training recurrence)*
id uuid, coach_id int, weekday int, start_time text, duration_minutes=90, category text, court_name text, court_address?, max_participants=4, price_aed numeric, description_en/ru?, active bool=true, until_date date?, created_at, updated_at.
FK: `coach_id → users(id)`.

### `skill_assessments` — 12 rows
id, user_id int, answers text(JSON), computed_level text, notes?, verified_by_admin bool=false, submitted_at, verified_at?. FKs: none declared.

### `trainer_match_requests` — 1 row
id, player_id int, format='4v4', venue='Padel Edition', requested_date text, requested_time text, notes text, status='pending', assigned_match_id int?, created_at. FKs: none declared.

### `training_bookings` — 0 rows
id uuid, training_id uuid, user_id int, status='booked', booked_at, cancelled_at?, created_at.
FKs: `training_id → group_trainings(id)`, `user_id → users(id)`.

### `video_analyses` — 0 rows
id, user_id int, video_url, player_shirt_color, analysis_query?, status='pending', assigned_coach_id int?, analysis_report?, delivered_at?, response_time real?, upload_date. FKs: none declared.

### `reminder_logs` — present in Drizzle schema (created via Task #128)
id, user_id int, sent_at timestamptz, triggered_by text ('auto'|'manual'), sender_user_id int?, delivered bool. *Not visible in this snapshot's `information_schema` listing — see drift note above; verify with `\d reminder_logs` after the next clean push.*

> **Last modified (proxy):** All `created_at`/`updated_at` columns default to `now()`. `pg_stat_user_tables` reports zero live tuples in this snapshot (stats not auto-analyzed after the last restart), so "last modified" can only be approximated by `SELECT max(created_at)` per table on demand.

---

## Section 3 — Express routes inventory

Base prefix: `/api`. Mount order (from `routes/index.ts`): health, auth, padel_future, stats, users, matches, bookings, video_analyses, coach, courts, match_requests, assessments, admin, coaching, padel_rules, padel_news, matchmaking, registrations, trainer_match_requests, group_trainings, notifications, internal, recurring_series.

Auth column legend:
- **public** — no token required
- **requireAuth** — router-level `router.use(requireAuth)` (any logged-in user)
- **requireAdmin** — per-route admin check
- **requireAdminOrCoach** — owner / admin / coach
- **requireOwnerOrAdmin** — owner / admin only (custom guard inside `admin.ts`)

### Health
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/healthz` | public | Liveness probe |

### Auth
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/auth/check-email` | public | Pre-check if email already registered |
| POST | `/auth/register` | public | Create account + return JWT |
| POST | `/auth/login` | public | Email or username login |
| GET | `/auth/me` | reads token if present | Return current user, or 401 |
| POST | `/auth/forgot-password` | public | Issue password reset token + email |
| POST | `/auth/reset-password` | public | Consume token to set new password |

### Users (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/users` | requireAuth | List users (filtered) |
| GET | `/users/find-matches` | requireAuth + LEVEL_REQUIRED | Archetype-aware suggestions (top 3) |
| GET | `/players/:id/profile` | requireAuth | Aggregate profile (matches, feedback) |
| PATCH | `/players/:id/profile/flags` | requireAuth | Update verified / coach-set flags |
| GET | `/players/:id/compatibility/:otherId` | requireAuth | Pairwise compatibility score |
| GET | `/users/:id` | requireAuth | Single user |
| PATCH | `/users/:id` | requireAuth | Update profile |
| PATCH | `/users/:id/availability` | requireAuth | Update availability slots |
| POST | `/users/:id/favourites` | requireAuth | Add favourite player |
| DELETE | `/users/:id/favourites` | requireAuth | Remove favourite |
| POST | `/users/:id/archetype` | requireAuth | Save quiz archetype + warmup pref |
| POST | `/users/:id/verify` | requireAuth | Mark verified (coach/admin in practice) |

### Matches (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/matches` | requireAuth | List matches |
| POST | `/matches` | requireAuth | Create match |
| GET | `/matches/suggestions` | requireAuth | Smart suggestions |
| GET | `/matches/:id` | requireAuth | Match detail |
| PATCH | `/matches/:id` | requireAuth | Update scores / status / notes |

### Bookings (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/bookings` | requireAuth | List bookings |
| POST | `/bookings` | requireAuth | Create booking |
| GET | `/bookings/:id` | requireAuth | Booking detail |
| PATCH | `/bookings/:id` | requireAuth | Update / cancel |
| POST | `/bookings/lateness-split` | requireAuth | Compute lateness payment split |
| POST | `/bookings/:id/payment` | requireAuth | Initiate (Stripe test) payment |
| POST | `/bookings/:id/confirm-payment` | requireAuth | Confirm payment |

### Video analyses (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/video-analysis` | requireAuth | List uploads |
| POST | `/video-analysis` | requireAuth | Submit video for analysis |
| GET | `/video-analysis/:id` | requireAuth | Detail |
| PATCH | `/video-analysis/:id` | requireAuth | Update / coach response |

### Coach (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/coach/players` | requireAuth | Coach's player list |
| GET | `/coach/upcoming-matches` | requireAuth | Upcoming matches for coach |

### Courts & court-bookings (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/courts` | requireAuth | List courts |
| POST | `/courts` | requireAuth | Add court |
| GET | `/courts/:id` | requireAuth | Court detail |
| GET | `/courts/:id/availability` | requireAuth | Available slots |
| GET | `/court-bookings` | requireAuth | List court bookings |
| POST | `/court-bookings` | requireAuth | Book a court |
| PATCH | `/court-bookings/:id/cancel` | requireAuth | Cancel |

### Match requests (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/match-requests/pending-count` | requireAuth | Unread count for badge |
| GET | `/match-requests` | requireAuth | List for current user |
| POST | `/match-requests` | requireAuth + LEVEL_REQUIRED | Player→player invite |
| PATCH | `/match-requests/:id` | requireAuth | Accept / decline / update |

### Assessments (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/assessments/user/:userId` | requireAuth | Latest skill assessment |
| POST | `/assessments` | requireAuth | Submit assessment answers |
| POST | `/assessments/:id/verify` | requireAuth | Coach/admin verify |

### Admin (per-route `requireOwnerOrAdmin`, with Mike-email exception on `GET /admin/users`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/users` | requireAdmin (+ Mike) | List users, filterable by `userType` |
| PUT | `/admin/users/:id/level` | requireAdmin | Override level |
| DELETE | `/admin/users/:id` | requireAdmin | Delete user |
| PATCH | `/admin/users/:id/user-type` | requireAdmin | Reclassify real/test/pf |
| GET | `/admin/incomplete-profiles` | requireAdmin | Players w/o level + reminder eligibility/history |
| POST | `/admin/incomplete-profiles/:id/remind` | requireAdmin | Manual reminder (429 if cooldown/cap hit) |
| POST | `/admin/incomplete-profiles/remind-all` | requireAdmin | Bulk reminder |
| PUT | `/admin/users/:id/role` | requireAdmin | Change role |

### Coaching (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/coaching/clients` | requireAuth | List Misha's clients |
| GET | `/coaching/clients/:id` | requireAuth | Full profile (sessions, notes, msgs) |
| POST | `/coaching/clients` | requireAuth | Add client |
| PUT | `/coaching/clients/:id` | requireAuth | Edit client |
| GET | `/coaching/sessions` | requireAuth | Sessions list |
| POST | `/coaching/sessions` | requireAuth | Log session |
| PUT | `/coaching/sessions/:id` | requireAuth | Update session |
| POST | `/coaching/notes` | requireAuth | Add post-match note |
| PUT | `/coaching/notes/:id` | requireAuth | Edit note |
| DELETE | `/coaching/notes/:id` | requireAuth | Delete note |
| GET | `/coaching/messages` | requireAuth | List messages |
| POST | `/coaching/messages` | requireAuth | Send message |
| PUT | `/coaching/messages/read/:clientId` | requireAuth | Mark as read |
| GET | `/coaching/recurring` | requireAuth | Weekly slots |
| POST | `/coaching/recurring` | requireAuth | Add weekly slot |
| POST | `/coaching/clients/:id/mark-session` | requireAuth | Decrement package count |
| GET | `/coaching/today` | requireAuth | Today's session list |

### Padel rules
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/padel-rules` | public (no `requireAuth`) | Rules library EN/RU/AR |

### Padel news
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/padel-news` | requireAuth | Feed |
| POST | `/padel-news` | requireAdmin | Publish news item |

### Matchmaking
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/matchmaking/suggest` | requireAuth + LEVEL_REQUIRED | Generate Best/Balanced/Challenging/Easy suggestions |

### Registrations (admin approval queue)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/registrations` | requireAdmin | Pending registrations |
| GET | `/admin/registrations/count` | requireAdmin | Count for badge |
| PUT | `/admin/registrations/:id/approve` | requireAdmin | Approve |
| PUT | `/admin/registrations/:id/reject` | requireAdmin | Reject |
| DELETE | `/admin/registrations/:id` | requireAdmin | Hard delete |

### Trainer match requests (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/trainer-match-requests` | requireAuth | List |
| POST | `/trainer-match-requests` | requireAuth + LEVEL_REQUIRED | Player → trainer request |
| PATCH | `/trainer-match-requests/:id` | requireAuth | Assign / update status |
| GET | `/trainer-match-requests/candidates` | requireAuth | Candidate players for trainer |
| POST | `/match-feedback` | requireAuth | Post-match peer feedback |
| GET | `/match-feedback` | requireAuth | Read feedback |

### Group trainings (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/group-trainings` | requireAuth | Public list of sessions |
| GET | `/group-trainings/me/bookings` | requireAuth | My bookings |
| GET | `/group-trainings/:id` | requireAuth | Session detail |
| POST | `/group-trainings` | requireAuth (coach role enforced inside) | Create session |
| PATCH | `/group-trainings/:id` | requireAuth (coach/owner) | Update |
| DELETE | `/group-trainings/:id` | requireAuth (coach/owner) | Cancel |
| POST | `/group-trainings/:id/book` | requireAuth | Book a slot |
| DELETE | `/group-trainings/:id/booking` | requireAuth | Cancel booking |
| GET | `/group-trainings/:id/bookings` | requireAuth | Roster (coach view) |

### Notifications (all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/notifications` | requireAuth | List |
| GET | `/notifications/unread-count` | requireAuth | Badge count |
| POST | `/notifications/:id/read` | requireAuth | Mark read |
| POST | `/notifications/read-all` | requireAuth | Mark all read |

### Internal
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/internal/tick` | public (no guard in router) | Manual scheduler tick (used by smoke tests) |

### Recurring series (group-training templates, all `requireAuth`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/recurring-series` | requireAuth | List templates |
| POST | `/recurring-series` | requireAuth | Create template |
| PATCH | `/recurring-series/:id` | requireAuth | Edit template |
| DELETE | `/recurring-series/:id` | requireAuth | Deactivate template |

### Stats
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/stats/dashboard` | requireAdmin | Admin dashboard metrics |
| GET | `/stats/player/:id` | requireAuth | Per-player stats |
| GET | `/stats/activity` | requireAdmin | Activity feed |
| GET | `/stats/participants` | public | Homepage participant counter |

### Padel Future (lead-capture mini-app)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/pf/register` | public | Create pf lead |
| POST | `/pf/quiz` | public | Submit quiz answers |
| GET | `/pf/session/:sessionId` | requireAuth | Read session result |
| GET | `/pf/admin` | requireAdminOrCoach | Admin overview |
| GET | export CSV paths | requireAdminOrCoach | Export pf data |
| GET | users-list paths | requireAdminOrCoach | List pf users |
| GET | user-detail paths | requireAdminOrCoach | Single pf user |

---

## Section 4 — Active and queued tasks

(From the platform task board snapshot at audit time.)

### Active / in progress

**Task #136 — Show admins which players opted out of reminders**
Status: `IN_PROGRESS` (last reported `MERGING` / waiting for lock).
Description: Once Task #135's cooldown + cap shipped, admins still cannot see which players have hit the cap vs. opted out manually. Add a visual marker in the Incomplete Profiles tab indicating "opted out" or "cap reached", driven by the reminder eligibility data already returned by `GET /admin/incomplete-profiles`.
Blockers: Pending DB-lock release on the `reminder_logs` table during merge; no functional blocker.

### Queued / proposed

**Task #137 — Block court bookings and group-training joins when player has no level**
Status: `PROPOSED`.
Description: Mirror the matchmaking-level guard (Task #131) for `POST /court-bookings` and `POST /group-trainings/:id/book` so unlevelled players can't bypass via deep link or mobile clients.
Blockers: None.

**Task #138 — Automated tests that prove unlevelled players really are blocked**
Status: `PROPOSED`.
Description: End-to-end tests against the LEVEL_REQUIRED guards on matchmaking, match-requests, trainer-match-requests, find-matches, plus the new ones from Task #137.
Blockers: Depends on Task #137 landing first to have a complete surface to test.

**Task #141 — Let players opt out of other email types too**
Status: `PROPOSED`.
Description: Extend the (planned) email-preferences model so players can opt out of categories beyond setup reminders (announcements, training notifications, etc.). Requires a `user_email_preferences` table or a JSON column on `users`.
Blockers: Depends on the opt-out plumbing introduced for Task #136.

**Task #142 — Add an unsubscribe link inside reminder emails**
Status: `PROPOSED`.
Description: Append a signed, single-click unsubscribe URL to every reminder email; route handles the opt-out and records who opted out and when.
Blockers: Depends on #141.

### Recently cancelled

- **Task #130** — Turn on real email delivery once your sending domain is ready. Cancelled (gated on external DNS work; not a code task).
- **Task #139** — Admin-configurable cooldown/cap. Cancelled (defaults shipped in #135 are good enough).
- **Task #140** — Player opt-out of setup reminder emails. Cancelled in favour of the broader #141.

---

## Section 5 — Active integrations & external services

| Integration | Status | Where it lives |
|---|---|---|
| **PostgreSQL** | ✅ Active. `DATABASE_URL` set, Drizzle ORM connects on boot. 25 tables. | `lib/db/*`, all `routes/*` |
| **MongoDB** | ⚠️ Scaffolded only. `lib/mongo` package exists (`client.ts`, `collections.ts`, `types.ts`) but the API server does **not** import it. No `MONGO*` env vars are read anywhere in `artifacts/api-server/src`. Plan doc: `.local/tasks/mongodb-analytics-layer.md`. | `lib/mongo/*` |
| **Telegram bot @PadelCoachAssistant** | ❌ Not wired. No `TELEGRAM*` env var referenced in code, no `telegraf`/`node-telegram-bot-api` package installed, no routes. Documented as a future integration; nothing in the running stack. | n/a |
| **Email (Resend)** | ⚠️ Code wired, **disabled in this env**. `lib/mail.ts` uses the official `resend` SDK and is invoked from `reminderJob.ts` and `auth.ts` (welcome + password-reset). `RESEND_API_KEY` is **not** in the secret list, so `mail.ts` logs `"Email sending skipped — RESEND_API_KEY not configured"` and returns. `EMAIL_FROM` defaults to `Padel Concierge <noreply@padelconcierge.com>`; `APP_URL` derives from `REPLIT_DOMAINS`. | `artifacts/api-server/src/lib/mail.ts`, `lib/reminderJob.ts` |
| **Stripe payments** | ⚠️ Test-mode placeholders only. `/bookings/:id/payment` + `/confirm-payment` exist but no Stripe SDK calls — the README documents a fake card flow. | `routes/bookings.ts` |
| **Replit Auth / OAuth providers** | ❌ Not used. JWT in localStorage only. | `lib/auth.ts` |

### Background workers / cron

Implemented as in-process `setInterval` timers booted from `artifacts/api-server/src/index.ts`:

1. **`groupTrainingScheduler`** (`lib/groupTrainingScheduler.ts:272`) — runs every **15 minutes**. Generates the next occurrences from active `recurring_series` rows and inserts them as `group_trainings`. Skips already-generated occurrences.
2. **`reminderJob`** (`lib/reminderJob.ts:171`) — runs every **N minutes** (interval set in module). Loads players with `archetype IS NULL` + role `player`, evaluates per-user cooldown (48h) and cap (5 total), then calls `sendReminderToUser` for the eligible ones. Logs every send to `reminder_logs` and bumps `users.reminderSentAt`.
3. **`POST /internal/tick`** — manual trigger for the two schedulers above, intended for smoke tests / cron-from-outside; currently unguarded.

No external scheduler (cron, Temporal, BullMQ) is configured.

### Environment variables actually read by the API server

`process.env.{ADMIN_EMAILS, APP_URL, EMAIL_FROM, LOG_LEVEL, NODE_ENV, REPLIT_DOMAINS, RESEND_API_KEY, SUPER_ADMIN_CODE}` plus the implicit `DATABASE_URL` consumed by the Drizzle client and `SESSION_SECRET` consumed by JWT signing.

---

## Section 6 — Known gaps and TODOs

### Explicit TODO/FIXME comments
Greps for `TODO|FIXME|XXX|HACK` in `artifacts/{api-server,padel-concierge}/src` and `lib/db/src` returned **zero** comment markers. (The matches that did surface were false positives — e.g. `"v2"` inside the format constant `"2v2"` in `match_requests.ts` and `match-requests.tsx`, level labels like `"1.0": "lv10"` in `assessment.tsx`, and the word `"later"` in a scheduler comment.) The codebase is unusually clean here; gaps below come from inspection, not from in-code markers.

### Schema drift (real, not annotated)
- `player_profiles`, `match_logs`, `compatibility_scores`, `feedback_aggregates` are declared in `lib/db/src/schema/` but **do not exist** in the DB. Post-merge `drizzle-kit push` stalls on the interactive prompt:
  > Is `player_profiles` table created or renamed from `pf_users` / `pf_quiz_results`?
  …because the script can't answer. Result: every recent merge succeeds at the code level but ships with schema drift.
- `pf_users`, `pf_quiz_results`, `court_bookings` live only in the DB; they have no Drizzle schema file. Future `db:pull` will fight `db:push`.

### Integrations advertised but not wired
- **MongoDB analytics layer** — package exists, never imported by the running app.
- **Telegram bot** — referenced in product docs, no code.
- **Real email delivery** — `RESEND_API_KEY` missing in this env; every reminder/welcome/reset email is logged-and-skipped. (Task #130 was cancelled, but the gap remains.)
- **Stripe** — endpoints are stubs, no SDK calls.

### Auth / authorisation gaps
- `POST /internal/tick` has no guard — anyone who knows the path can force a scheduler tick.
- `GET /padel-rules` is mounted without `requireAuth` (likely intentional, but worth noting against the rest of the API).
- `POST /users/:id/verify` is `requireAuth` only — relies on client-side role checks to keep players from self-verifying.
- `match_feedback` and `match_requests` have no DB-level FKs even though their schema files declare them, so orphaned rows are possible.

### Planned-but-not-implemented work from task plans
The following plan docs in `.local/tasks/` describe work that has **not** shipped:
- `mongodb-analytics-layer.md` — entire analytics layer.
- `ios-mobile-redesign.md` — partial; documented as ongoing polish.
- The "follow-up tasks" file mentions further i18n passes (Arabic for coach pages) and email preference work (#141/#142).

### Commented-out blocks suggesting unfinished work
- None of substance — the recent commits are tight diffs without dead-code blocks. The closest thing is the early-2026 `// so that an occurrence later in the day is still produced.` comment in `groupTrainingScheduler.ts:57`, which is a real explanation, not a TODO.

---

## Section 7 — Last 10 git commits

| # | SHA | Date (UTC) | Message | Files changed |
|---|---|---|---|---|
| 1 | `ce91a19` | 2026-05-26 17:37 | Task #135: Add per-player reminder cooldown and cap | 3 |
| 2 | `2abaddc` | 2026-05-26 17:31 | Translate remaining English status labels across coach pages | 3 |
| 3 | `4a9f486` | 2026-05-26 17:25 | Task #132: Persistent no-level nudge in AppLayout | 1 |
| 4 | `a5b260c` | 2026-05-26 17:23 | Task #131: Block matchmaking server-side when player has no level | 4 |
| 5 | `b1f6085` | 2026-05-26 16:31 | Task #129: Bulk "Напомнить всем" for incomplete profiles | 2 |
| 6 | `a418509` | 2026-05-26 16:27 | Task #128: Reminder history log per player | 5 |
| 7 | `59ad551` | 2026-05-26 16:20 | Translate remaining English labels in client profile to Russian | 1 |
| 8 | `550c3b7` | 2026-05-26 16:16 | Task #126: Translate video analysis pages to Russian | 3 |
| 9 | `78d97ea` | 2026-05-26 16:12 | Task #125: Translate coach group trainings page to Russian | 3 |
| 10 | `74ad7f4` | 2026-05-26 16:08 | Add level-required guard for find-match and match-request flows | 3 |

---

*End of report. No code or schema was modified during this audit.*
