# 0003: Require Durable Message and Effect State

Status: Accepted
Date: 2026-08-24

## Context

Chat and email providers retry events, processes stop between side effects, and
network timeouts can leave delivery outcomes ambiguous. OpenClaw and Hermes both
contain paths that deduplicate before completed processing or retry delivery
without a stable provider identity. DSH session logs preserve agent context but do
not own channel obligations or business-effect idempotency.

## Decision Drivers

- Do not lose accepted inbound work.
- Do not report an ambiguous external effect as successful.
- Make retries safe across process and pod replacement.
- Preserve a queryable accountability record independent of model transcripts.

## Decision

The supervisor transactionally owns a durable inbox, outbox, task ledger, approval
ledger, and effect ledger. Every operation has a stable ID. Inbound events are
committed before acknowledgement, outbound obligations before delivery, and
ambiguous outcomes remain `unknown` until reconciliation. DSH session events link
to, but do not replace, this state.

## Consequences

- Positive: Restart and retry semantics are explicit and testable.
- Positive: Provider and Harness histories can be correlated without sharing
  ownership.
- Negative: Exactly-once behavior remains impossible when a provider lacks
  idempotency or reconciliation.
- Negative: Transaction boundaries and retention require careful schema evolution.
- Follow-up: Initial implementation uses SQLite for one-pod ownership; centralized
  services use a database appropriate to their writer model.

## Confirmation

- Fault injection covers every commit, dispatch, delivery, and acknowledgement
  boundary.
- Repeated provider and supervisor operation IDs resolve to one accepted operation.
- An ambiguous timeout produces `unknown`, never `completed`.
