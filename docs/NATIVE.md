# Native frontend and authentication foundation

This provides a static frontend bundle, a cookie-independent API transport,
and tested browser/deep-link authentication contracts. [Electron desktop packaging](./ELECTRON.md)
adds OS-backed encrypted storage, deep links, and installers. [Triton42 Expo](./EXPO.md)
is the universal product frontend in `frontend/universal`; it preserves offline SQLite persistence.

## Build a bundle

Configure the clone's backend and public endpoints in `.env`:

```dotenv
APP_ID=my-product
APP_NAME=My Product
APP_URL=https://app.example.com
NATIVE_API_URL=https://app.example.com/api
NATIVE_AUTH_ENABLED=true
NATIVE_APP_SCHEME=com.example.my-product
NATIVE_TRUSTED_ORIGINS=app://localhost
```

List only the exact origins used by your selected platforms. Restart the backend
after changing authentication configuration. There are no wildcard origins or
`null` origins. Native endpoints and bearer support are disabled by default.
The native scheme must be unique per product and identical on the server and in
the installed app. Verified HTTPS app/universal links are preferable where the
product has the necessary domain associations; this foundation uses an explicit
custom scheme plus PKCE for the browser authorization handoff.

```bash
pnpm native:build
```

The output is `frontend/out-native/`, including a public `native-manifest.json`.
The build stages a separate copy of the frontend, omits Next.js server proxy and
rewrites, enables static image delivery and directory-based routes, and leaves
the regular web source/build untouched. It compiles only an explicit public
configuration allowlist and scans generated text assets for supplied server
secret values. No backend credentials belong in `NEXT_PUBLIC_*` values.

HTTPS is required for release endpoints. For local testing only:

```bash
NATIVE_API_URL=http://localhost:8080/api APP_URL=http://localhost:8080 pnpm native:build --development
```

Development HTTP is restricted to localhost/loopback and the Android emulator's
`10.0.2.2` host alias. Real phones need a reachable HTTPS backend. Rebuild the
bundle when its public endpoints or identity change. The hosted web app continues
to use the ordinary `pnpm build` and Docker workflows.

## Session transport and platform adapter

Native API requests use signed bearer sessions, omit cookies, reject redirects,
and restrict token-bearing requests to the configured API origin/path. Web
requests retain normal cookie authentication. Logout revokes the server session
before clearing its local token; expired/revoked sessions clear on validation.
Persistent session tokens are never written to browser localStorage/sessionStorage.
Successful password resets revoke the account's existing sessions.

Before the native frontend renders, the platform bootstrap installs
`window.fullstackNative`, implementing `NativePlatform` from
`frontend/src/lib/native/platform.ts`:

| Method                         | Required behavior                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secureStorage.get/set/remove` | Store session and pending PKCE values in an OS-backed secure store or an encrypted vault with an OS-protected key; never Preferences/localStorage/plain files. Keys include clone ID and API URL. |
| `openExternal(url)`            | Open the system browser, rather than navigating the app WebView to a provider.                                                                                                                    |
| `onDeepLink(listener)`         | Subscribe to app URL events and return an unsubscribe function.                                                                                                                                   |
| `getLaunchUrl()`               | Return and consume an initial launch URL, or `null`.                                                                                                                                              |

Without an adapter, a static browser preview can use an in-memory email session;
it does not persist across reloads and cannot start the browser handoff. Packaging
must supply the secure adapter before any authentication request. Tests provide
an isolated fake adapter to verify the contract, not OS storage security.

## Browser sign-in and password reset

“Continue in browser” creates a random verifier, S256 challenge, and state. The
backend stores the challenge for five minutes in Redis and returns a hosted
`/native/connect` page. The user logs in using the existing hosted email or OAuth
flow and explicitly authorizes the app. The callback contains a one-time code
and state, never a session token. A valid verifier/state/code exchange consumes
the code atomically and creates a separate native session. The authorized code
expires after sixty seconds. Native logout leaves the browser session intact.

The native lifecycle validates scheme/host/path and pending state before calling
the exchange endpoint. Invalid state, wrong verifier, expired requests, and
concurrent/repeated redemption are rejected. An intercepted custom-scheme sign-in
code is insufficient without its stored verifier. Redis loss requires restarting
the sign-in flow; it does not issue a session.

Password-reset requests also create a PKCE-bound pending flow in the app. Email
links use the hosted `/native/reset` landing page, where the user can prepare an
app link or finish in the browser. The custom-scheme link carries a one-time code,
not the reset token. Only the initiating app, with its stored verifier and state,
can exchange it for the token over HTTPS. Reset exchanges cannot create sessions.
Better Auth validates reset expiry/single use when the password is submitted.
The five-minute pending flow and sixty-second approved code deadlines also apply
to reset handoffs; expired app requests can still finish in the hosted browser.
Treat the original email link as sensitive. Platform URL associations and handling
of other installed apps are verified during the packaging steps.

When Turnstile is configured, native credential entry and reset requests go
through the hosted browser flow so the challenge runs on its registered web
hostname. Live OAuth provider configuration and live Turnstile remain external
acceptance checks; this does not bypass their validation.

## Verification

```bash
pnpm test:native --browser-container
```

This runs the existing web/integration suite and serves the exported bundle on a
second loopback origin. Native browser checks cover authenticated API calls with
no cookies, profile uploads, adapter-backed reloads, revocation, browser consent,
invalid/replayed callback state, password-reset app links, and JavaScript errors.
Backend checks cover exact native CORS origins, signed tokens, PKCE tampering,
concurrent single-use redemption, expired requests, and session independence.

Use `pnpm test:native --project=chromium --project=mobile-webkit` for installed
macOS Playwright engines. Reports and cleanup follow [TESTING.md](./TESTING.md).
CI runs this superset of the web tests. Mobile device testing remains a
separate release check. Browser emulation does not establish native platform compatibility.

References: [Next.js static export](https://nextjs.org/docs/app/guides/static-exports),
[Electron custom protocols](https://www.electronjs.org/docs/latest/api/protocol), and
[Better Auth bearer authentication](https://better-auth.com/docs/plugins/bearer),
and [client session refresh](https://better-auth.com/docs/concepts/client).
