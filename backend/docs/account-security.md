# Triton42 account controls

The desktop sidebar account button and mobile Menu → Fiók open the account panel. Account name and image use the existing `/users/me` and `/profile-images/optimize` endpoints. Password changes send a confirmation email and retain the current password until explicit email approval, regardless of the 2FA setting. Approval revokes other sessions; the initiating session stays signed in. Account deletion requires the current password and typed email confirmation in the UI; Better Auth deletes the user and database relationships cascade. The current image and files belonging to owned calendars are cleaned up after the database deletion succeeds (storage failures are logged), and the app removes the deleted account's local SQLite cache without touching other accounts or anonymous data.

## Optional email two-factor authentication

Email 2FA defaults to enabled. Password sign-in requires a fresh email approval when enabled; verified users can disable or re-enable it in Account → Security using their current password. Registration always verifies email ownership. The setting is a read-only user field outside the dedicated, password-protected `/two-factor/email/settings` endpoint. The password response revokes its provisional session before any bearer token can be exposed. The email contains a single-use button valid for ten minutes. Clicking it approves only that attempt; the browser or native app that started it polls with its independent signed challenge cookie and receives the session. Opening the email on another device works without sending a session token through the email URL. Cancellation, replacement and expiry invalidate the attempt; a mail delivery failure leaves the user signed out. Trusted-device bypasses, authenticator enrollment and recovery-code login have been replaced by this flow. Existing signed-in sessions are preserved.

Challenges use the existing `verification` table with separate hashed device and email secrets. Approval and session claiming are atomic. Migration `0009_email_security` preserves existing accounts’ effective email protection and sets the default for new accounts to enabled. Native apps retain the short-lived challenge cookie in SecureStore so approval survives an app restart, and store the signed bearer only after approval. Native requests send the configured API origin explicitly; cookie-bearing approval polling remains subject to Better Auth’s Origin/CSRF validation. Web requests leave Origin and HttpOnly cookies to the browser.

The shared running backend uses Resend SMTP from the main, Git-ignored `.env` file with `Triton42 <noreply@triton42.hu>` as sender. No separate provider environment file is required. A real setup email was accepted by SMTP and shown as Delivered in the Resend dashboard. Mailpit remains available only for isolated development tests. Resend Free uses the existing SMTP transport after verifying `triton42.hu` in the Resend dashboard. Configure sending DNS records from Resend in Cloudflare, keep click/open tracking disabled for login links, and use a sending-only API key restricted to the verified domain:

```dotenv
MAIL_PROVIDER=smtp
MAIL_FROM="Triton42 <noreply@triton42.hu>"
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASSWORD=<resend-sending-api-key>
```

Localhost and `triton42.hu` share this backend transport; localhost is not a sender domain and needs no Resend domain entry. Activate the complete settings only after sender verification and an SMTP delivery check. The Free quota is shared by all environments, including login and password-reset emails.

The email approval URL uses `MOBILE_APP_DOMAIN` when configured so it remains reachable without the web site's Cloudflare Access login. Otherwise it uses the application origin.

## Email confirmation for password changes

`/auth/change-password` validates the authoritative session and current password, hashes the proposed password, stores a ten-minute pending request, and sends an email. It never immediately updates the credential, even when 2FA is disabled. Only the latest request can be used. Raw new passwords are never stored.

The email opens `/auth/password-change/confirm`; GET shows a confirmation form so email scanners cannot apply a password. Its explicit POST atomically checks expiry, single use, the unchanged current password hash and account email, then updates the credential, revokes other sessions, and invalidates pending login/password-change challenges. SMTP failure, replacement, expiry or an intervening password reset leaves the current password unchanged. Tokens are random 256-bit values, stored only as SHA-256 identifiers.

## Cloudflare Turnstile

Configure `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in the environment, then rebuild/restart the frontend and backend. The backend exposes only the public site key in `/api/config`. Add `triton42.hu` and development `localhost` to the widget's allowed hostnames. Better Auth validates the `x-captcha-response` token for registration, login, and password-reset requests. Missing, invalid, or expired tokens fail when CAPTCHA is enabled.

Web renders the widget directly. Mobile uses the HTTPS page `/captcha/triton` in a WebView, following Cloudflare's mobile integration requirements. `EXPO_PUBLIC_CAPTCHA_URL` can select that hosted page when the web and API hosts differ. The public route must be accessible to signed-out users; an upstream Cloudflare Access login currently blocks native access to the public site. This implementation does not change that Access policy.

Without widget keys, the integration remains disabled. No Cloudflare test key is used as a production fallback.

## Cloudflare R2 storage

The existing S3 storage adapter supports R2 for avatars, calendar imports, and attachments. Keep the bucket private: only validated avatar paths are served by `/api/files/images/profile-images/:userId/:filename`; calendar content continues to require authenticated calendar access. Public bucket access would also expose private imports.

Configure `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `R2_REGION=auto`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET`. Set `R2_PUBLIC_URL` to the backend's public `/api/files` URL, `R2_FORCE_PATH_STYLE=false`, and `STORAGE_AUTO_CREATE_BUCKET=false`. Use an Object Read & Write credential scoped to this bucket. The bucket must exist before connecting it; no database changes are required. Do not enter partial R2 credentials into the active environment: local development storage stays in use until the remote configuration is complete. Existing objects remain in local storage until explicitly transferred.

## Verification

Against a disposable development environment with CAPTCHA disabled:

```sh
TEST_APP_URL=http://localhost:4042 TEST_ORIGIN=http://localhost:3042 node backend/test/integration/account-http.mjs
pnpm --filter @triton42/universal test
```

The HTTP check creates its own account and covers account image upload/removal, rename, calendar data deletion, email approval, password-only session rejection, link reuse rejection, bearer issuance, password change, and account deletion. App tests cover deletion cache isolation. Do not run the HTTP fixture against real user accounts.

Email login endpoint tests are in `backend/test/email-login.test.mjs`. The Postgres atomicity test uses a connection-local temporary verification table and runs with `TEST_EMAIL_STORE_DB=true` against a development database. It never changes the application verification table.

The account security handler tests cover optional 2FA, protected settings, deferred password changes with 2FA on/off, form submission, replay and SMTP failure. `password-change-store.test.mjs` uses temporary tables to verify PostgreSQL atomicity, expiry, replacement, stale passwords, changed email and session revocation without modifying real accounts.
