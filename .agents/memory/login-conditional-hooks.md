---
name: Login page conditional-hooks crash
description: A real Rules-of-Hooks violation in an auth/login page that bounces a successful login back to an empty form.
---

# Auth pages: hooks after conditional returns crash on login success

A page that calls data/mutation/effect hooks (e.g. `useLogin`/`useMutation`, `useRef`, `useEffect`) **after** early conditional returns such as `if (isLoading) return null;` and `if (user) return <Redirect/>` has a genuine Rules-of-Hooks violation.

**Symptom:** valid credentials submit, fields clear, user bounced back to an empty login form (not logged in). Backend is fully healthy (login 200, `/auth/me` 200, token stored, `setAuthTokenGetter` wired). The break is purely client-side: when `user` flips truthy while the login component is still mounted, React renders fewer hooks than the previous render and throws "Rendered fewer hooks than expected", crashing the page back to login.

**Why it can pass casual testing:** dev auto-login (`/login?auto=player`) navigates away (component unmounts) before the bad render path, so the happy path looks fine. The crash depends on update batching / Strict Mode / Fast Refresh, making it intermittent.

**How to apply:** declare ALL hooks at the top of the component, then do conditional returns. This is distinct from the `hmr-fewer-hooks-false-positive` note: a one-off "fewer hooks" right after Vite startup is often an HMR artifact, but if the same component places hooks after conditional returns, it is a real bug — fix the hook order.
