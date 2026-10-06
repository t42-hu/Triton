# Electron desktop

`desktop/` packages the same Next.js frontend as the hosted web app for macOS,
Windows, and Linux. The isolated Electron preload exposes only encrypted
storage, opening the system browser, and deep-link delivery. The renderer has
no Node.js integration. It loads the exported UI from a local secure
`app://localhost` origin; the backend remains a separate service.

After `./start.sh`, set the following values in the root `.env` and restart
the backend:

```dotenv
NATIVE_AUTH_ENABLED=true
NATIVE_APP_SCHEME=my-product
NATIVE_TRUSTED_ORIGINS=app://localhost
NATIVE_API_URL=https://api.example.com/api
APP_URL=https://app.example.com
ELECTRON_BUNDLE_ID=com.example.myproduct
ELECTRON_ICON=frontend/public/logo.svg
ELECTRON_MAINTAINER=Your Name <you@example.com>
```

Use a unique scheme and bundle ID for each product. `NATIVE_APP_SCHEME` must
match the scheme packaged into the desktop app. `APP_URL` hosts the browser
authorization and password-reset handoff; `NATIVE_API_URL` points to its API.
The icon can be any SVG, PNG, or JPEG file in the clone; the build generates
the platform sizes from it. Linux DEB packaging requires
`ELECTRON_MAINTAINER`; set it to your real contact before release.
Production builds require HTTPS. For local development, the `electron:dev`
command permits loopback HTTP; the backend must be reachable at the configured
address. Expo uses its own auth switch and API URL.

```bash
pnpm electron:dev
pnpm electron:prepare
pnpm electron:package
pnpm electron:make
```

`electron:dev` creates a development static bundle, then opens Electron.
`electron:prepare` creates the release bundle and public desktop settings.
`electron:package` creates an unpacked app for the host OS.
`electron:make` creates a DMG/ZIP on macOS, an NSIS installer on Windows, or
AppImage/DEB packages on Linux, under `desktop/out/`. Builds contain the
public API URL and product identity, so rebuild after changing them. Neither
server secrets nor provider credentials belong in the app.

Native sign-in uses a system browser and a one-time PKCE-bound callback. The
desktop session is stored with Electron `safeStorage` under an app-specific
directory. Linux builds refuse session storage when no system keychain is
available instead of falling back to Electron's `basic_text` backend.

The template produces unsigned local artifacts. Before distributing them,
configure product-owned Apple signing/notarization and Windows signing
credentials and test the installers on each target OS. Desktop CI builds
unsigned artifacts; publishing and automatic updates are product decisions.

References: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security),
[custom protocols](https://www.electronjs.org/docs/latest/api/protocol),
[safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), and
[electron-builder configuration](https://www.electron.build/docs/configuration/).
