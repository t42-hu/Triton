# Observability and client failures

The backend writes one JSON object per log line through Pino. HTTP logs include
`reqId`, method, sanitized path, status, response time, service, and environment.
Send a valid `X-Request-ID` to continue an upstream correlation ID; otherwise the
backend creates a UUID and returns it in `X-Request-ID`. The browser may read this
header through CORS.

Request bodies, query strings, IP addresses, cookies, authorization headers,
captcha responses, and response headers are not logged. Pino redaction adds a
second defense for common credential, token, email, and password fields. Reset
and email-verification tokens in URL paths are replaced before logging. Keep new
logs structured and do not place personal or secret values inside message text.

Configure the minimum level with `LOG_LEVEL` (`info` by default). Liveness traffic
is excluded from access logs and traces. Client errors have a stable JSON shape:

```json
{
    "statusCode": 400,
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "requestId": "b7bf2bc4-...",
    "details": ["email must be valid"]
}
```

Expected 4xx failures are recorded by the access log. Unexpected 5xx failures
also include the exception type and stack frames, with raw provider messages and
nested causes omitted. Profile-image cleanup failures emit a warning while the
successful profile update remains successful.
BullMQ jobs carry the request and W3C trace context in BullMQ's telemetry metadata,
without changing the product payload. Worker failures include queue, job, and
originating request identifiers.

## Optional OpenTelemetry

Tracing is disabled unless explicitly enabled:

```dotenv
OTEL_ENABLED=true
OTEL_SERVICE_NAME=my-product-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

The Node SDK exports OTLP/HTTP traces and honors standard OpenTelemetry variables,
including `OTEL_EXPORTER_OTLP_HEADERS` and the trace-specific endpoint/headers.
Prefer an OpenTelemetry Collector between the application and a vendor backend.
Database, Redis, inbound/outbound HTTP, Nest/Express, and queue processing spans
share trace context. JSON logs include `traceId` and `spanId` while a span is active.

The ESM entry point initializes the SDK and loader hook before importing the
application. Exports allow only method/status/system/operation/request-ID
attributes. Span names use the instrumentation scope; raw URL paths/queries, SQL,
exception events, and arbitrary attributes are excluded. Automatic resource
detection is disabled to avoid exporting process arguments or machine metadata.
Metrics and OpenTelemetry log export are disabled; application logs remain on stdout.

Do not enable the exporter until its endpoint is reachable from the backend
network. Export failure never changes an API response, but it produces diagnostic
output and loses traces. `pnpm test:unit` checks automatic HTTP and manual span
export against a disposable local receiver, including sensitive-data exclusion.
The integration runner deliberately ignores your exporter settings. For a real
collector, enable it on a development deployment, call `/api/config`, and search
the returned request ID in both application logs and the trace backend.

## Optional System Stats agent

Set `STATSD_ENABLED=true` in `.env` to add `exelban/statsd` to either Compose
stack, then start that stack normally. The agent stores its account link in
`./statsd` by default; this directory is ignored by Git. Follow the pairing
link shown by `pnpm dev:logs statsd` or `pnpm prod:logs statsd`.
`./statsd.sh` enables and starts the development agent and opens its pairing
page; `./start.sh` runs it automatically before attaching to tmux. Unused device
codes expire after about five minutes. Rerun `./statsd.sh` to get a fresh code;
the script leaves an already paired agent alone. This is the
[System Stats monitoring agent](https://system-stats.com/download/statsd/),
not the StatsD UDP aggregation protocol and not this application's OTLP exporter.
It sends machine and Docker metrics to the vendor's cloud dashboard, and an
account link is required before cloud delivery can be verified.
The publisher describes Docker support as an open beta. The template pins its
current `latest` image to a digest so clones use the same binary until an image
update is reviewed.

Run one agent per Docker host even if several clones are deployed there.
`STATSD_DATA_DIR` can point at an existing private directory when its identity
must live outside the checkout. The service uses host networking and mounts
the Docker socket. The vendor says remote container control is on by default;
the socket's `:ro` bind flag does not make Docker API requests read-only. Only
enable this profile if you want that access, and use the vendor's
`statsd disable-control` command if you want dashboard monitoring without
remote commands. On Docker Desktop for macOS, host networking is limited, so
the container's host metrics may represent the Linux VM rather than macOS. See
[Docker's daemon-socket security guidance](https://docs.docker.com/engine/security/protect-access/)
and [host-network limitations](https://docs.docker.com/engine/network/drivers/host/).

## Frontend error contract

Web and Electron requests use the same client. It applies a 15-second
deadline, safely handles empty/non-JSON responses, validates success payloads with
Zod, and classifies cancellation, offline/network failures, timeout, validation,
session expiry, forbidden access, rate limiting, server failure, and invalid
responses. Retryable failures are marked on `ApiError`; mutations are never
retried automatically. Native 401 responses clear the secure session and notify
the session store.

User-visible server errors include the request reference when available. Support
can search that value in JSON logs without asking for credentials or personal data.
