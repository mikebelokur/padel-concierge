# Veronika — Founding Member #001 Invite

**Generated:** 2026-05-26 (overnight Task #3)
**Finalized:** 2026-05-27 (Task #151)

## Member record

| field            | value                                          |
|------------------|------------------------------------------------|
| `users.id`       | `47`                                           |
| `name`           | Veronika                                       |
| `email`          | `veronika.padelconcierge@example.com`          |
| `role`           | `player`                                       |
| `member_number`  | `1`                                            |
| `badge`          | `founding_member`                              |
| `invite_status`  | `invited`                                      |
| `invite_token`   | `cf4ace51-cf80-4e81-9e68-1638efd8a781`         |
| `expires_at`     | `2026-06-03 15:39:32 UTC` (still valid)        |
| `mode_player`    | `true`                                         |
| `mode_coach`     | `false`                                        |
| `mode_admin`     | `false`                                        |
| `mode_developer` | `false`                                        |

Confirmed via:
```sql
SELECT id, name, role, mode_player, mode_coach, mode_admin, mode_developer
FROM users WHERE id = 47;
-- → 47, Veronika, player, t, f, f, f
```

## Invite URL

Full URL produced overnight (Task #3) and verified live on 2026-05-27:

```
https://23a57365-a8fd-47ff-af40-200fef47a201-00-165yfrh7giigy-cedc33ji.pike.replit.dev/invite/cf4ace51-cf80-4e81-9e68-1638efd8a781
```

If the deployment is moved to a custom domain, swap the host for the value in `$REPLIT_DOMAINS` (comma-separated list of published hosts) and keep the `/invite/<token>` path unchanged.

> **Security note:** this invite token grants account access until expiry. Rotate it via `/admin/users` immediately after Veronika redeems it, or run the SQL below to regenerate.

Token expires **2026-06-03 15:39 UTC**. If Misha needs to extend, regenerate via the admin user panel (`/admin/users`) or:
```sql
UPDATE users
SET invite_token_expires_at = now() + interval '7 days'
WHERE id = 47;
```

## Instructions for Misha

1. Open the link above on a phone (the install prompt is mobile-only).
2. After Veronika sets her password the route lands her on `/dashboard` in **player** mode. The founding-member ribbon appears on her profile in `/admin/users` and `/admin/clients/47`.
3. If the token has expired before she opens it, regenerate it (SQL above) and resend.
4. Her welcome experience: PWA install banner appears after her second visit on mobile.

## Notes

- `mode_player=true` is the only mode flag set on her account — she is a pure player and will see the player-tier nav from Task #C's IA restructure.
- Founding-member badge UI (Task #4) renders the gold ribbon automatically for `badge = 'founding_member' AND member_number = 1`.
