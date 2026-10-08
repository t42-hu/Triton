# Calendar backend

The NestJS backend extends the existing Better Auth email/password login. Every route below requires a browser session cookie or a signed native bearer session token. The universal frontend uses these routes for account storage and keeps SQLite as a per-account offline cache. Email/password login opens before profile creation; registration is the first of three setup steps. Old anonymous device profiles are copied only after an explicit transfer choice, leaving the original local data intact.

OpenAPI is generated from Nest routes and shared Zod contracts into `openapi.json`. `pnpm api:generate` also regenerates the frontend API client. Bodies reject unknown fields. IDs can be UUIDs or stable client-generated identifiers using letters, digits, hyphens and underscores. Ownership, timestamps and versions are set by the server.

## Domain records

`GET /api/calendar/:resource` lists accessible records, ordered by ID. `limit` defaults to 100 and is at most 200; pass the returned `nextAfterId` as `afterId` for the next page. Supported relationship filters are `calendarId`, `eventId`, `profileId`, `sourceId`, `meetingId`, `presetId`, `deviceId`, only on resources that contain those fields.

`GET /api/calendar/:resource/:id` reads one record. `POST /api/calendar/:resource` creates a record. `PATCH /api/calendar/:resource/:id` updates fields with an integer `version` in the body. `DELETE /api/calendar/:resource/:id` takes `{ "version": 1 }` and writes a tombstone. Writes return the new record/version. A stale version returns HTTP 409; refresh and resolve the conflict rather than silently overwriting.

| Resource                                                         | Access / write behavior                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `calendars`                                                      | Owner creates and manages; members read                                            |
| `members`                                                        | Owner changes role or revokes; creation through accepted invitation                |
| `invitations`                                                    | Issuer and recipient read; owner revokes; special response action                  |
| `profiles`, `profile-calendars`, `calendar-preferences`          | Personal schedule configuration                                                    |
| `sources`                                                        | Calendar readers see metadata; editors manage; deletion also deletes source events |
| `source-connections`, `source-revisions`                         | Owner only; revision creation through publication; revisions read only             |
| `events`                                                         | Calendar editors write; members and meeting participants read                      |
| `recurrences`, `exceptions`                                      | Calendar editors write; authorized users read                                      |
| `attachments`                                                    | Calendar editors add/update/delete links; file upload is separate                  |
| `meetings`                                                       | Organizer edits status or removes meeting; creation through special action         |
| `participants`                                                   | Event attendees read; organizer revokes; invitation and RSVP actions               |
| `overrides`, `tasks`, `notebook-links`                           | Personal notes, overrides, tasks and notebook links                                |
| `palettes`, `palette-colors`, `color-rules`                      | Personal saved colors and rules                                                    |
| `reminder-settings`, `event-reminder-settings`, `reminder-rules` | Personal reminder configuration                                                    |
| `preferences`, `devices`, `device-preferences`                   | Personal synchronized preferences and device configuration                         |

Calendar roles are `editor`, `reader`, and `busy_only`. Only the owner manages sharing. Busy-only reads contain timing, recurrence and cancellation information, without titles, notes, locations, colors or attachments. A meeting invitation grants access to that meeting's event and its shared notes/links/files, without exposing other events in its calendar. Pending and declined invitees retain this event preview until the organizer revokes the invitation. Guests cannot edit the event. Personal overrides, tasks and saved colors never become shared through the calendar.

Each event has `title`, `notes`, `location` and optional `color`; shared files and links are separate attachment rows. Meetings refer to these same event records. Timed events require `startsAt < endsAt` and null date fields. All-day events require `startDate < endDate` and null timestamp fields; the end date is exclusive. Timezones are IANA names. RRULE syntax is parsed with ICAL.js before storing recurrences. Cross-user profile/preset/device relationships are rejected.

Deleting a calendar, event, meeting, source, profile, palette or device soft-deletes the associated dependent records. Personal tasks and notebook links keep their own content. Soft-deleted data and private object blobs are retained; a production retention/garbage-collection policy is a separate operational task. IDs remain reserved after deletion; restoring arbitrary records through generic CRUD is not supported.

## Invitations and meetings

- `POST /api/calendar-actions/invitations`: `{calendarId, userId | email, role, expiresInDays?}`. The owner invites one recipient. Email invitations require a verified email before they can be discovered or accepted; configure an email-verification flow before using that option. Inviting an existing user ID works with the current email/password setup. Exactly one recipient selector is required; there is no public user-directory endpoint.
- `POST /api/calendar-actions/invitations/:id/respond`: `{version, response: "accepted" | "declined"}`. Only the recipient responds. Acceptance and membership creation happen in one transaction.
- `POST /api/calendar-actions/meetings`: `{event: <event create body>, participantUserIds?: [...], status?: "draft" | "published"}`. Creates the event, meeting and participant records atomically.
- `POST /api/calendar-actions/meetings/:id/invite`: `{userIds: [...]}`. Organizer invites existing user IDs.
- `POST /api/calendar-actions/meetings/:id/respond`: `{version, response: "accepted" | "declined" | "tentative"}`. Version refers to the caller's participant row.

These endpoints store invitations for discovery through the API. They do not send email or push notifications.

## Private attachments and imports

`POST /api/calendar-files/events/:eventId` accepts multipart field `file`, at most 20 MiB. The uploader needs event edit access. When virus scanning is configured, upload fails unless the scanner returns clean. Files are stored privately in the configured S3-compatible bucket. Database responses omit storage keys and invitation token hashes.

`GET /api/calendar-files/attachments/:id` checks event permission and streams the file as a download with `private, no-store` and `nosniff` headers. Link attachments use generic `attachments` CRUD with `kind: "link"`, `name` and an HTTP(S) `url`. Clients cannot submit arbitrary file storage keys.

`POST /api/calendar-actions/sources/:sourceId/publish` takes `{version, content, coverageFrom, coverageTo, events: [...]}`. The calendar owner supplies raw source content and normalized event records. Each event needs a unique `externalUid`; `calendarId`/`sourceId` are server assigned. The existing client import parser remains responsible for interpreting ICS/JSON; this API does not fetch arbitrary remote URLs or verify that normalized fields match the raw content. `content` is capped at 1 MB; the overall JSON body limit is 2 MB.

All event changes, disappeared-event tombstones, the current revision switch and source coverage update commit together. Existing external UIDs keep their event identity and active personal overrides. An empty event list intentionally publishes an empty source. Failed publication cleans up its newly uploaded raw object; the previous revision stays active.

## Device synchronization

1. Register with `POST /api/sync/devices`, using `{installationId, platform, name?, pushToken?}`. Persist the returned device ID. Re-registering the same installation is safe and can reactivate it after account login. Device registration does not replace session authentication.
2. Call `GET /api/sync/snapshot?deviceId=...&limit=200`. The response has a `snapshotToken`, string `highSequence`, frozen `{resource, record}` items, and `nextOffset`. Fetch remaining pages using the same token and returned offset. Pages cannot be skipped. Tokens expire after 15 minutes; the initial implementation caps snapshots at 50,000 records.
3. Replace the device's synchronized cache using the completed snapshot while preserving pending local mutations. Acknowledge with `POST /api/sync/ack` and `{deviceId, sequence: highSequence, snapshotToken}`. Incomplete, expired or access-invalidated snapshots cannot be acknowledged.
4. Pull `GET /api/sync/pull?deviceId=...&after=<acknowledged or delivered sequence>`. Apply changes by version, then acknowledge `nextSequence`. A deleted parent (calendar, source, event, meeting, profile, palette or device) also removes its dependent cache records. Sequences are decimal strings to preserve bigint precision. A page scans up to `limit` global changes, so it may contain no visible changes while `hasMore` is true; still advance/acknowledge the returned position.
5. When `requiresSnapshot` is true, obtain and replace the cache with a new snapshot before resuming incremental pull. Sharing and participant changes trigger this so a grant includes existing records and a revocation/role downgrade removes previously cached details. Server authorization prevents future access; it cannot erase copies already downloaded or saved by a recipient.
6. Upload local changes through `POST /api/sync/push`: `{deviceId, mutations: [{clientMutationId, resource, operation, id?, version?, data?}]}`. The batch is atomic, limited to 100 mutations, and fails entirely on a conflict. Updates/deletes require ID and expected version. Persist a stable mutation ID until it is acknowledged. An identical retry returns the recorded result subject to current access; changing its payload with the same ID returns 409. Link attachments are supported here; multipart files and special invitation/meeting/import actions use their own routes.

The database's global transaction advisory lock keeps feed positions ordered by commit. Writes, sync snapshots and sync cursor operations take that lock; normal CRUD reads use a consistent read-only transaction. This is appropriate for an initial single-server deployment, and should be measured before scaling to large user counts. Frozen snapshot JSON is private server data and belongs in database backups. Expired snapshot records are cleaned up when a new snapshot is requested. Feed tombstones and mutation receipts are currently retained rather than pruned.

## Continuous hosting through Cloudflare Tunnel

Use the production Compose stack on the always-on server, with persistent PostgreSQL/Redis volumes, private S3-compatible storage, automatic Docker startup, backups and health monitoring. Existing production services and `cloudflared` use `restart: unless-stopped`.

Traffic flows as `https://your-domain → Cloudflare Tunnel → proxy:8081 → Next.js / NestJS`. The proxy already routes `/api/*` to the backend and the website to Next.js, with the existing Next.js `/api/calendar-import` route preserved. Multipart event uploads have a separate 21 MiB proxy limit. Native/desktop clients use the same public HTTPS origin and signed bearer sessions; visitors do not install cloudflared or open database ports.

Use a persistent named tunnel and the project configuration for `PROD_APP_DOMAIN`, `APP_URL`, Better Auth origins, native app schemes/trusted origins, storage and secrets. Do not put an interactive Cloudflare Access login wall in front of the public application API unless the mobile/desktop clients also implement that additional protocol. Keep authenticated API paths out of custom Cloudflare cache rules; these calendar/sync responses set `Cache-Control: private, no-store`.

`pnpm prod:tunnel:up` starts the existing production tunnel stack after configuring its environment. The migration service handles schema changes before the backend starts; take a database backup before upgrades. Continuous availability also depends on the server staying powered on, having connectivity and recovering after reboot. This backend change does not deploy to a remote server or configure its DNS.

Cloudflare reference: https://developers.cloudflare.com/tunnel/concepts/routing/

## Universal frontend synchronization

The universal app uploads profiles, their calendars and imports, effective event overrides, notes, categories, tasks, notebook links, subscription connections, reminder rules, saved palettes, event color rules and supported display preferences. Global preferences follow the account; navigation, zoom, notification permission and battery prompt state remain device specific. Native session tokens are stored with Expo SecureStore. Browser sessions use HttpOnly cookies. Passwords are never stored in calendar preferences or SQLite.

Writes debounce for 1.5 seconds, with a foreground/60-second retry and a manual action in account settings. Stable IDs and persisted mutation receipts support interrupted uploads. Expected versions protect against concurrent edits; the UI offers server/local conflict resolution. Choosing the server copy keeps a local conflict backup. Unsupported shared/meeting domain records remain on the server rather than being deleted by this personal-calendar UI.

Normalized occurrences and metadata are stored in the existing PostgreSQL tables. Original JSON/ICS imports use the existing private object storage/revision tables. `GET /api/calendar-files/sources/:id/content` retrieves a source's current private original for its owner, allowing a new device to restore reimportable source content. It also supports manual JSON sources. Session tokens, notification identifiers and sync receipts remain local/device storage. No schema migration is needed for this integration.

Web calls same-origin `/api`. Native defaults to `https://triton42.hu/api`; development previews may set `EXPO_PUBLIC_API_URL` to the local backend. Android enables cleartext HTTP only for a configured local development endpoint. Development cookie hosts are restricted to the application host and `TRITON_WEB_ORIGIN` (default `http://localhost:3042`); production keeps the configured HTTPS origin. Signed native bearer sessions are enabled.

The public domain currently has a Cloudflare Access gate. Native clients cannot use a browser-only Access login; make the authenticated application API reachable through an approved Access policy before distributing public mobile builds. Local previews use the same backend at port 4042 without altering the public Access policy.
