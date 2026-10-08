# Triton42 account controls

The desktop sidebar account button and mobile Menu → Fiók open the account panel. Account name and image use the existing `/users/me` and `/profile-images/optimize` endpoints. Password changes revoke other sessions. Account deletion requires the current password and typed email confirmation in the UI; Better Auth deletes the user and database relationships cascade. The current image and files belonging to owned calendars are cleaned up after the database deletion succeeds (storage failures are logged), and the app removes the deleted account's local SQLite cache without touching other accounts or anonymous data.

## Authenticator 2FA

Apply `0004_account_two_factor.sql` through the migration runner before deploying the new backend. It only adds the user flag and the Better Auth `two_factor` table, including verification and lockout fields. Authenticator secrets and recovery codes are encrypted by Better Auth.

Enrollment requires the current password, displays a locally generated QR code/manual key and recovery codes, and activates only after a valid authenticator code. Login remains unauthenticated until the second factor succeeds. Native apps hold the short-lived challenge cookie in memory and persist the signed bearer session in SecureStore only after verification. Recovery codes are single-use; new codes invalidate the old set.

Authenticator codes and recovery codes need no SMTP. The existing mail service supports `MAIL_PROVIDER=smtp` (Nodemailer/provider SMTP), `ses` (AWS SES API), and `disabled`. Mailpit is available for local development. Email OTP would need an explicit delivery handler; it is not enabled here.

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

The HTTP check creates its own account and covers account image upload/removal, rename, calendar data deletion, TOTP enrollment, password-only session rejection, invalid code rejection, recovery-code login and reuse rejection, bearer issuance, password change, and account deletion. App tests cover deletion cache isolation. Do not run the HTTP fixture against real user accounts.

Final native installation and visual verification are deferred while the other T3 session retains device control at the user's request. The initial account bundle was installed preserving existing app data; the final QR/cache updates are staged separately.
