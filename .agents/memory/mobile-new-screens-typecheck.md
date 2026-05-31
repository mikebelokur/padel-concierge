---
name: Mobile new screens — typecheck & route types
description: Two stale-cache gotchas when adding Expo screens that use freshly generated API hooks or new route files.
---

When adding new screens to the Expo app (`artifacts/mobile`) that import newly generated
React Query hooks or schemas from `@workspace/api-client-react`, two stale-cache issues
cause confusing typecheck failures even though the symbols clearly exist in source:

1. **Composite lib build cache.** `@workspace/api-client-react` is a composite lib; the
   mobile app typechecks against its emitted declarations, not `src/`. If you (or codegen)
   just added hooks like `useCreatePlayMatch`, mobile typecheck reports "no exported member"
   until you rebuild the lib with `pnpm run typecheck:libs` (`tsc --build`). The "Did you
   mean useCreateMatch?" hint is the tell.

2. **Expo-router typed routes.** Adding new route files (e.g. `app/play/match/[id].tsx`)
   produces `router.push("/play/...")` type errors because `.expo/types/router.d.ts` is
   stale. It is regenerated only when the Expo dev server runs — restart the
   `artifacts/mobile: expo` workflow, then typecheck passes.

**Why:** both caches are filesystem artifacts that don't refresh on a bare `tsc --noEmit`.
**How to apply:** after adding mobile screens with new hooks/routes, run
`pnpm run typecheck:libs` and restart the expo workflow before trusting mobile typecheck.
