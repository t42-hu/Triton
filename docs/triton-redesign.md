# Triton42 redesign

Approved scope: apply the video's alignment, grouping, visual hierarchy and selective emphasis principles to the universal app, retaining Hungarian copy, Triton branding, system fonts, light/dark themes, custom event colors and all existing behavior.

## Sections

1. Shared controls: consistent 8px control corners, 12px panels, restrained borders, 44px iOS / 48px Android targets, visible labels and focus states.
2. Authentication and setup: readable field groups, calmer step navigation, compact profile preview, keyboard and safe-area accommodation.
3. Navigation: 24px page titles, neutral supporting icons, selected-page emphasis, preserved desktop rail and mobile swipe/tab navigation.
4. Lists: fixed time/title/action columns, color-independent row geometry and separate title/metadata hierarchy.
5. Today: primary next event, flat statistics and planning groups, useful loading and empty states.
6. Timetable: neutral canvas and controls, readable time labels, preserved zoom, comparison, drag and paging behavior.
7. Tasks: deadlines grouped by Budapest calendar date, explicit completed/overdue states, unchanged completion workflow.
8. Search: labels for query and profile scope, distinct initial/loading/empty/error states, unchanged debounce and filters.
9. Editors: shared labeled fields and consistent footer spacing; preserve draft protection, validation, focus and dismissal behavior.
10. Settings/account/maps: flat sections, restrained icon decoration, readable picker and directions groups, unchanged integrations and permissions.

## Delivery requirements

Publish with `pnpm --filter @fullstack-starter/frontend build:triton`; inspect the actual Next.js app on port 3042 and public site. Browser verification uses visible Safari Technology Preview only.

Refresh the native staging sources, export current embedded bundles and update the existing `hu.t42.triton` apps on the installed Pixel 7 (`Orarend_API_35`) and Device Hub iPhone. Preserve application data and signing identity. Keep native windows and T3 Device panels visible. Inspect affected screens on each platform and report unverified states honestly.

Existing unrelated workspace changes must remain outside the redesign patch. Review against the pre-edit source snapshot, not the already dirty Git HEAD.

## Verification

The current web export is published in Next.js, and both installed native apps were updated from refreshed staging without data loss. The signed-in web, iOS and Android workspaces are available in their visible previews. Settings, timetable, event actions and dark-mode corrections were inspected; the settings audit records the detailed checks and remaining unexercised cases.

Universal typecheck, lint and 97 tests pass; date grouping covers Budapest midnight and DST boundaries. Tunnel tests pass. Android authentication completed with Turnstile and the mobile API host, while the main web host retains Cloudflare Access.

## Proposed commit sections

1. Shared controls and editors: consistent borders, spacing, touch sizes, focus and keyboard accommodation.
2. Workspace screens: navigation, Today, timetable, deadline groups and search states.
3. Settings: five concise categories, separate A/B page, simpler color controls and synchronization layout.
4. Event interactions: direct saved quick links, compact timetable icons on all platforms, five-minute drag snapping and dark-theme fallback colors.
5. Native authentication delivery: separate mobile API/CAPTCHA host, Turnstile WebView and restricted proxy ingress.

These are review groups, not blanket commits of the dirty workspace. Existing unrelated account, backend, dependency and map work remains in place.
