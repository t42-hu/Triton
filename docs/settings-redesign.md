# Settings audit and redesign

The user requested analysis before implementation, then a simple, quiet layout across web, iOS and Android. Existing Hungarian copy, themes and behavior remain the basis.

## Findings

- Root menu: tall 80px rows, icon containers and repetitive summaries consume space without improving the choice.
- Subpages: modal heading, back link and another page heading repeat hierarchy.
- Appearance: a single choice needs no explanatory panel or autosave copy.
- Calendar: obvious switch descriptions duplicate labels. Routine display settings and the consequential A/B recalculation belong on separate pages.
- Colors: type prompt, explanation, disclosure and long threshold labels make a small form look complex. Minute units belong in labels. Color and threshold should sit in one coherent group.
- Synchronization: category name promises account editing, while the content provides synchronization. Generic sign-in and sign-out prose is redundant. Errors and conflict consequences remain useful.
- Color picker: uppercase labels and separate preview headings repeat the purpose. Keep named presets, a small event preview, saved colors and optional custom controls.
- Related account screen: authentication instructions and irreversible-delete warnings convey real consequences; retain them. Account editing remains in the existing Fiók destination.

## Design

Five root rows, each with one neutral icon, a label and a disclosure arrow: Megjelenés, Órarend, A/B hetek, Eseményszínek, Szinkronizálás. Subpage title replaces the root title. A small back control returns to the menu. No repeated subtitle.

Use the existing system font: 20px modal title, 16px section titles, 14px labels, 12px metadata. Preserve the existing palette: light #FFFFFF / #F1F5F9 / #1F2937 and dark #111318 / #1B1E23 / #B8C1CC; the existing blue accent signals selected controls and primary actions. No new theme or font dependency.

Left-aligned fields, 16px group spacing, 24px between meaningful sections. Flat rows and dividers replace nested framed panels. Controls retain 44px iOS and 48px Android targets. Thresholds group the status name, color and minutes; one save action follows the draft. Confirmations, error feedback, synchronization conflict resolution and draft persistence are retained.

The hierarchy follows the real scheduling tasks rather than an ornamental card layout. Separate A/B weeks reduces density while making its broader effect visible at the relevant action.

## Validation

Published the universal web export into the actual Next.js app on port 3042. Inspected localhost authentication and the signed-in public application in visible Safari Technology Preview. Opened all five settings pages and exercised the missing-link editor fallback.

Refreshed native staging from current sources and updated the installed Pixel 7 and Device Hub iPhone apps without clearing data. Both retained their signed-in workspaces. Opened all five settings pages, the color picker, timetable quick-link icons and event editor. Native screenshots confirm readable dark timetable text and borders, unobscured settings back navigation and five outlined editor buttons.

Universal typecheck, lint and all 97 tests pass. The two tunnel tests pass. The five-minute drag tests cover positive and negative movement, duration and zoom. Palette contrast tests cover light/dark colors and extreme black/white inputs.

The deployed mobile CAPTCHA shows Turnstile, and the Android sign-in completed successfully. Unauthenticated mobile profile requests return 401; the normal web host retains its Access redirect.

Following the user's correction, both small quick-link icons are restored directly to every timetable event on all platforms, including non-lesson and all-day events. The separate native quick-link list was removed. Icon controls remain compact within the scaled grid, and event text reserves space for them. Undefined accent colors are omitted from inline styles so NativeWind's theme colors remain active. Stored custom colors retain their existing contrast adjustment.

Validation avoided applying A/B recalculation, changing passwords or overwriting saved color rules. A preconfigured external-link launch was not exercised against user data; the shared resolver opens the first saved URL and preserves the editor fallback.
