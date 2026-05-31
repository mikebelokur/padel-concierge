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
