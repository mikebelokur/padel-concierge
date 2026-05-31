---
name: Open play-match approval boundary
description: Why open play-matches must never grant entry via the invite link/token.
---

Open play-matches admit players ONLY through request → leader approval. The shared
invite link/token is a PRIVATE-match mechanism. Two rules keep them separate:

- Never expose `inviteToken` in any non-participant payload (e.g. the open-browse
  summary or the by-token preview). If it leaks, anyone can harvest it and join.
  Keep `inviteToken` on the room object only, gated to participants.
- `POST /play-matches/join/:token` must gate by visibility: direct participant
  insert is allowed for private matches, explicit invitees, or already-approved
  users only. For open matches with no invite/approval, create a pending request
  and return 202 `{pending,matchId}` instead of inserting.

**Why:** code review flagged that returning `inviteToken` in the open browse list
let any authenticated user bypass leader approval. Two layers (don't leak the
token + gate the join endpoint) are intentional defense-in-depth.

**How to apply:** any new endpoint that returns a play-match summary must use
`buildSummary` (token-free), not the room shape, for non-participants.

## Closed/forming status + removal must be enforced on EVERY mutating path

When a match leaves `forming` (e.g. leader cancel → `cancelled`), the status flag
alone does nothing — every join/request/invite/respond/remove handler must
independently re-check `match.status === FORMING_STATUS` and return 409, or a
cancelled match keeps accepting players through whichever path skipped the check.

Removal/decline must be expressed as a `declined` row AND honored by the join
eligibility logic:
- `hasInvite` / "may join directly" must require status `pending`/`approved`,
  never `type === "invite"` alone — a declined invite must not re-authorize entry.
- Private-room view auth (`GET /play-matches/:id`) must require an *active*
  (`pending`/`approved`) request row; a declined row must NOT grant viewing.
- A removed player who joined a PRIVATE match directly may have no request row at
  all; removal must insert a `declined` marker so the join path knows to funnel
  them back through leader approval instead of the visibility===private shortcut.

**Why:** code review found cancelled matches were still joinable and removed users
could re-enter via stale token/declined rows or keep viewing private rooms.
**How to apply:** treat `declined` as a hard block in any new join/eligibility
check, and add the `forming` guard to any new mutating play-match endpoint.
