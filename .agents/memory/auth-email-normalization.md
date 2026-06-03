---
name: Auth email normalization + credential error misclassification
description: Two bugs that make a valid login look like an "email typo"; how email must be normalized across auth endpoints.
---

# Login: case-sensitive email lookup + "invalid email" substring trap

Two independent bugs that together made a correct login show a client-side "email typo" error while the API worked fine via curl:

1. **Case-sensitive / un-trimmed email lookup.** Auth endpoints query `users.email` with case-sensitive equality. A capitalized or space-padded email (browser autofill, mobile keyboards that auto-capitalize the first letter) misses the row and returns `401 "Invalid email or password"`. Normalize email with `String(raw).trim().toLowerCase()` in **every** auth endpoint that looks up or stores email: login, register, forgot-password (and any invite/reset/email-lookup path). The super-admin `email === "admin"` keyword normalizes to itself, so the bypass still works.

2. **Error-message substring trap.** The client error classifier matched `raw.includes("invalid email")` for the "email typo" code — but the credentials message `"Invalid email or password"` contains the substring `"invalid email"`, so every 401 was mislabeled as an email typo instead of "invalid credentials". Guard the invalid-email branch with `&& !raw.includes("password")` (or check credentials/status 401 first).

**Why:** the symptom is misleading — it points at the form's email field when the real cause is server-side normalization + an ordering bug in the error classifier.

**How to apply:** when adding an auth endpoint or a new error string, normalize email at the boundary and make sure no credential/permission message accidentally matches a more specific error code by substring. There is no DB-level case-insensitive uniqueness (no citext / `lower(email)` unique index), so canonicalize in app code.
