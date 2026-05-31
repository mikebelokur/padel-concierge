---
name: Typecheck in isolation vs root
description: Why per-package typecheck of api-server can fail when the root typecheck is clean
---

Running `pnpm --filter @workspace/api-server run typecheck` in isolation can fail with drizzle-orm errors like "Two different types with this name exist" / "separate declarations of a private property 'shouldInlineParams'" pointing at files you never touched (e.g. video_analyses.ts). The root cause is duplicate `@types/pg` versions in the pnpm store producing two `drizzle-orm` type identities.

**Why:** isolated leaf typecheck does not run `tsc --build` on the composite libs first, so the api-server resolves drizzle types differently than when the libs are prebuilt.

**How to apply:** trust the canonical root `pnpm run typecheck` (it runs `typecheck:libs` first, which dedupes), not an isolated per-package run. The same applies to the pre-existing React 19 ref-type errors in `mockup-sandbox` (calendar.tsx / spinner.tsx) — they are unrelated environmental noise, not regressions.
