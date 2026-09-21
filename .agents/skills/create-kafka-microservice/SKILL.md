---
name: create-kafka-microservice
description: Build Kafka microservices with userId-keyed events, dedicated per-user partitions, mailbox event ordering, and read-only query service separation.
---

# Create Kafka microservice

## Trigger

Use this workflow when a service must process events in strict user history order, especially mailbox-like actions such as mail creation, deletion, move, folder changes, or other queue-first workflows.

## Required inputs

- Service name and purpose
- Event list and payload contracts
- Ordering boundary identifier (default: `userId`)
- Topic names and versions
- Partition growth policy (`MAX_USERS_PER_QueProcessor_PARTITION` style)

## Architecture baseline

- Reusable Kafka core in `src/lib/kafka`
- Domain service in `src/services/<ServiceName>`
- Outbox as source of publish truth
- Consumer with manual offset commits
- Read-only independent data getter service for current-state queries

## Topic and event conventions

- Topic naming: `app.<domain>.<purpose>.v1`
- Use `mailboxEvents` for history-sensitive mailbox stream processing
- Event envelope fields:
  - `eventId`
  - `eventVersion`
  - `occurredAt`
  - `userId`
  - `sequence`
- Message key: `String(userId)`

## Partition guide

### 1) Create and grow partitions

- Ensure topic exists before producing.
- Create at least one partition at bootstrap.
- Keep a DB mapping table for `(topic, partition, userCount)`.
- Expand partition count when all tracked partitions reach user capacity.

### 2) Dedicate users to partitions

- On first user onboarding, assign a partition with lowest load.
- Persist partition on user record (`user.kafkaPartition` style).
- Keep assignment stable for that user.
- Publish all user events to the same partition.

### 3) Preserve order end-to-end

- Publish with both:
  - `key: String(userId)`
  - `partition: user.kafkaPartition`
- Enforce monotonic `sequence` per user at enqueue time.
- Reject or DLQ events that violate expected sequence.

## Queue and outbox workflow

Use a status lifecycle compatible with:

`PREQUEUED -> PENDING -> DISPATCHING -> PUBLISHED -> UNDER_PROCESSING -> SUCCESS`

Failure paths:

- `FAILURE`
- `PUSHED_FAILURE` and DLQ publish

Guidance:

- Use `PREQUEUED` for staged onboarding/history-gated tasks.
- Release to `PENDING` when user partition is assigned and ready.
- Claim atomically from `PENDING` to `DISPATCHING`.
- Commit consumer offsets only after processing completion.

## Mailbox events usage policy

Use `mailboxEvents` for operations where event order and full history matter, including:

- new mail
- move mail
- delete mail
- folder create/delete/rename
- any action that must be replayable in order

Do not bypass queue processing for these operations.

## Read-only data getter policy

For endpoints that only read current state:

- Use a dedicated unattended independent data getter service.
- Keep this service read-only.
- Do not write side effects in this service.
- Query from projections/current-state stores.

This keeps write workflows deterministic and read paths fast.

## Consumer and reliability policy

- Use one consumer group per processing role.
- Use manual commit mode (`enable.auto.commit = false`).
- Commit `offset + 1` after successful handling.
- Use idempotency key: `consumerGroup + topic + partition + offset`.
- Publish failed records to DLQ with original metadata.

## Minimal implementation sequence

1. Define topics in env and topic registry.
2. Define event schemas and versions.
3. Add user-partition assignment and persistence.
4. Implement outbox queue insert with `messageKey` + `kafkaPartition`.
5. Implement outbox publisher worker.
6. Implement consumer worker with idempotency and manual commits.
7. Implement DLQ publishing path.
8. Implement read-only data getter for current-state queries.
9. Add run scripts for split and all-in-one modes.
10. Test per-user order with mixed concurrent users.

## Acceptance checklist

- Same user events always land on one partition.
- Per-user sequence is monotonic and validated.
- Outbox status transitions are valid.
- Consumer replays are idempotent.
- DLQ receives failed events with original metadata.
- Read-only getter performs no state mutations.
