# Platform delivery

For every user-facing UI change, update and show the running web, Android, and iOS versions before declaring the task complete. The user explicitly requests this for every change.

- Web: export the universal app and publish it with `pnpm --filter @fullstack-starter/frontend build:triton`. Verify the actual Next.js app at port 3042 (and the configured public site when applicable), not only a separate static preview.
- Android and iOS: rebuild or refresh the installed app bundles from the current workspace, install on the available emulator/simulator without clearing application data, and open them in the T3 Device panels. Native build staging copies must be refreshed from current sources.
- Inspect the changed screens on all three platforms. Keep the previews open so the user can see the results. Report any platform that cannot be updated or verified; do not claim parity from a web-only check.

# Visible simulators

- Never use `--no-window`, `-no-window`, or headless/windowless simulator launches.
- Use the user's installed Pixel 7 emulator and existing Device Hub simulators, with native device windows visible. Boot them visibly before attaching T3 Device panels if the panel tool would otherwise launch a windowless device.
- Preserve installed application data. This preference also lives in `/Users/boss/.codex/AGENTS.md` for future conversations and other projects.

# Browser testing — user preference for every project and conversation

- Always use the installed Safari Technology Preview application for browser and web UI testing.
- Keep its browser window visible and verify the actual running application in Safari Technology Preview.
- Do not substitute regular Safari, Chromium, Chrome, bundled Playwright WebKit, or a T3 browser backed by a different engine. If Safari Technology Preview cannot be controlled, report the limitation before using another browser.
- This preference applies from now on to all projects, current conversations, and resumed or future conversations. Past test runs cannot be changed retroactively.
