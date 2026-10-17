# Calendar subscription audit — 2026-10-15

## Result

Subscription imports and Triton sharing can propagate an upstream change, but continuous refresh while the owner's app is closed is **not guaranteed**. There is no server subscription scheduler. The public share endpoint serializes the latest saved calendar events, rather than fetching upstream feeds.

## Changes in this audit

- Foreground and native background refresh now check all saved subscriptions, including peer profiles, multiple imports and legacy web subscriptions.
- Each source retains its own 15-minute attempt cooldown. Concurrent scheduled checks claim each source once. A failed download does not prevent the other links from refreshing.
- Native background registration now also considers peer and legacy subscriptions.
- Opening the app continues to check every link immediately.

## Live verification

A new WageTrackr account was created with the email provided by the user. Synthetic test data consisted of one workplace and one shift. Its public HTTPS subscription returned a valid ICS calendar without authentication, with CORS enabled.

The live audit used the production import/parser code against SQLite, a disposable Triton server fixture, the running Next.js API at port 3042 and the real public WageTrackr/Triton feeds:

1. Import WageTrackr shift starting at 08:00 Europe/Budapest.
2. Save its event through Triton's real API and create a work-category share.
3. Import that share into a separate recipient profile.
4. Change the WageTrackr shift to 10:00 through its normal authenticated API.
5. Confirm the Triton share still contains 08:00 before the owner refreshes/saves.
6. Refresh the owner import, save the changed event through Triton's API and fetch the same share URL.
7. Refresh the recipient import: it now contains 10:00, with stable event identity.

A second live run also exercised production `synchronizeWorkspace` and the automatic server-commit hook against the real HTTP backend: a further 10:00 → 11:00 change reached the recipient. That run used Node adapters for SQLite, the web platform constant and secure storage; it was not a browser UI test. Public feed responses were HTTP 200; Triton downloads returned `Cache-Control: private, no-store`. Disposable Triton fixtures were removed; the requested WageTrackr account and synthetic calendar remain available.

## Remaining limits

- Closed owner app: imported upstream changes remain stale until an app refresh uploads them. Native background execution depends on OS scheduling; iOS simulators do not run it.
- Third-party recipients choose their own polling schedule. A one-time ICS file import does not subscribe to future changes.
- A completely empty feed currently cannot replace a previously nonempty calendar. This protects against accidental erasure, but also prevents removing the final upstream event through sync.
- Import expansion only covers the saved import date range.

## Checks

118 universal tests and 4 backend sharing tests passed. Universal TypeScript check and targeted lint for the changed files passed. Full universal lint encountered existing errors in `auth-screen.tsx` and `auth-state.tsx` outside this change.

Android and iOS release builds succeeded and were installed without clearing app data. The web app was visibly loaded in Safari Technology Preview at port 3042. The web export was published with `pnpm --filter @fullstack-starter/frontend build:triton`. Native staging was refreshed from the workspace. UI interaction could not be fully isolated from other active Safari/device sessions; API/parser verification must not be represented as a complete three-platform UI acceptance run.

## Final availability recheck

After both successful live propagation runs, WageTrackr's public feed, local feed and health endpoint started returning HTTP 500. Redis returned `MISCONF Errors writing to the AOF file: No space left on device`; its logs showed short writes at 18:34–18:35 UTC. The host filesystem still had about 105 GiB free. Docker storage inspection commands stopped responding, so the container/VM storage fault was not repaired in this audit. No application data, Docker volumes or Redis persistence settings were removed or changed. The generated WageTrackr link therefore exists but was unavailable at final handoff; the earlier successful live tests do not establish current availability.
