---
name: Expo screens that redirect on role must wait for auth loading
description: Role-guarded expo-router screens bounce to a fallback on hard reload unless they gate on auth isLoading first.
---

Role-guarded screens that do `if (!isCoachUser(user)) return <Redirect .../>` will
incorrectly bounce to the fallback route on a hard page load / refresh (and in
Playwright `page.goto` deep links), because `AuthContext` loads the user
asynchronously and the first render has `user == null`.

**Why:** the synchronous redirect fires before auth resolves, so the screen never
recovers — it lands on the fallback even for an authorized user.

**How to apply:** read `isLoading` from `useAuth()` and render a spinner branch
*before* the role redirect: `if (authLoading) return <Spinner/>; if (!role) return <Redirect/>`.
Client-side nav (button press after auth already loaded) masks the bug, so test
with a hard reload / direct URL.
