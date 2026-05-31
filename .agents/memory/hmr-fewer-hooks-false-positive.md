---
name: HMR "Rendered fewer hooks than expected" false positive
description: When a one-off "fewer hooks than expected" runtime error is a Fast Refresh artifact, not a real conditional-hook bug
---

A reported `[RUNTIME_ERROR] ... "Rendered fewer hooks than expected. This may be caused by an accidental early return statement."` is often NOT a real code defect.

**Why:** React Fast Refresh (Vite HMR) can throw this once when a component file with hooks is hot-updated mid-edit and the in-flight old/new versions disagree on hook count. It is emitted by the Vite `runtime-error-plugin`, which only runs on web artifacts — so an error the user attributes to "mobile preview" can actually originate from a web (Vite) workflow. Metro/Expo has no such plugin.

**How to apply:** Before "fixing" a conditional hook, confirm it's real:
1. Check which workflow logged it — `[RUNTIME_ERROR]` lines come from the Vite web app, never Expo.
2. Note frequency/timing — firing exactly once right after "VITE ready" means an HMR reconnect on a stale page, a strong false-positive signal.
3. Statically verify the suspect components: every hook must sit above every early `return`, and route wrappers must render pages as JSX (`<Component/>`), not call them as functions (which would inline their hooks).
4. Reproduce with a real full page load (Playwright via `$REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE`, login, visit each route) — if a clean reload shows no error, it was an HMR artifact. Restart the workflow to clear the stale log.
