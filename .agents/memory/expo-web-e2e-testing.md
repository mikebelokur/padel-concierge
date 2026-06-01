---
name: Expo web e2e testing — host + Metro cache
description: Two gotchas that make Playwright (runTest) e2e against the Expo mobile artifact fail with a blank page or a stale screen.
---

Running `runTest` (Playwright) against the Expo mobile artifact (`artifacts/mobile`) has two
non-obvious failure modes that look like product bugs but are environment issues:

1. **Must target the Expo dev domain, not the proxy `/mobile/` path.** The artifact uses
   `router = "expo-domain"` and bypasses the shared proxy. The HTML served at the regular
   dev domain under `/mobile/` references the JS bundle with a ROOT-relative path
   (`/node_modules/.../entry.bundle`), which 404s on the proxy — so React never mounts and
   the page shows only "You need to enable JavaScript to run this app." (blank, empty aria
   snapshot). Point the test at the FULL absolute Expo dev domain URL
   (`https://$REPLIT_EXPO_DEV_DOMAIN/`) and navigate within the app from there.
   **Why:** the bundle script tag is root-relative; only the expo-domain host serves
   `/node_modules/...`. **How to apply:** pass the expo dev domain as the base URL in the
   test plan and warn the agent NOT to use the `/mobile/` proxy path.

2. **Metro serves a stale screen after a workflow restart.** Restarting the
   `artifacts/mobile: expo` workflow does NOT clear Metro's transform cache. A test can load
   fine but render an OLD version of a screen (e.g. a Play hub missing a newly-added "Past
   matches" section, showing removed sections instead). Before trusting a mobile e2e result,
   clear the cache: `rm -rf /tmp/metro-cache /tmp/metro-file-map-*` then restart the expo
   workflow and re-warm the bundle.
   **Why:** Metro caches transforms in `/tmp` across restarts. **How to apply:** if a mobile
   e2e shows content that contradicts current source, suspect stale Metro cache first.

Also: the player test account renders the app in Russian, so assert on `testID`s
(language-independent) rather than visible text where possible.
