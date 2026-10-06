# Billing and jobs

Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`STRIPE_ALLOWED_PRICE_IDS`. Checkout requires an authenticated user and a body
containing `priceId` and a UUID `requestId`. Generate that UUID once per checkout
attempt and reuse it on retries. Stripe rejects reuse with different parameters.
Its idempotency retention is finite; the application should not retry an old
checkout indefinitely.

Each user has a persisted Stripe customer. A database advisory lock plus a Stripe
idempotency key prevents concurrent creation during retries. Sessions contain
both customer and user identifiers. Webhooks require Stripe's original signed
request body; invalid signatures return 400.

Webhook processing serializes by event ID, records the event, updates the payment
ledger, invokes `PaymentEventHandler`, and marks completion in a transaction.
A committed duplicate is acknowledged without running effects again. Failed
transactions return an error so Stripe retries. Checkout updates serialize by
session ID and paid status cannot regress on out-of-order delivery. Only
sessions linked to this application's customer/user mapping update its ledger.
Unrelated events remain recorded for inspection.

Implement product-specific database effects in
`backend/src/payment/payment-event.handler.ts` using the supplied transaction.
For remote side effects, insert an outbox record in that transaction and deliver
it asynchronously with an idempotent worker. The template provides one-time
checkout and a payment ledger; subscriptions, refunds, tax, and product
entitlements require explicit product rules. Restrict database access and define
retention for webhook payloads, which may contain customer data.

Queues default to five attempts with exponential backoff, one-day/1,000-job
successful retention and seven-day/5,000-job failed retention. Worker and queue
connection failures are logged; failed jobs remain inspectable through BullMQ's
API. A processor must be idempotent because stalled/retried jobs may execute
again. Configure a stable job ID where duplicate submission should be suppressed.
The shared Redis instance uses `noeviction` so job state is not silently evicted.
Monitor memory and separate caches from job infrastructure when workloads grow.
