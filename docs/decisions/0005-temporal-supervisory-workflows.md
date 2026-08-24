# 0005: Limit Temporal to Supervisory Workflows

Status: Accepted
Date: 2026-08-24

## Context

The employee needs durable timers, approvals, retries, and multi-step business
processes. Temporal provides these primitives, but Activities are at-least-once and
must be idempotent. Wrapping every model step or tool call in Temporal would
duplicate DSH session ownership and still would not make arbitrary external effects
exactly once.

## Decision Drivers

- Gain durable waiting, human signals, and worker recovery.
- Preserve DSH as the owner of agent turns and transcripts.
- Avoid introducing distributed workflow infrastructure before core operation
  semantics are proven.
- Avoid building a competing general-purpose workflow engine.

## Decision

Implement the first durable inbox, outbox, task, and timer slice without Temporal.
Add Temporal for task-level and business-process orchestration after restart and
idempotency tests pass. One workflow represents one task or bounded process. DSH
turns and connector effects run as Activities with operation IDs, heartbeats, and
effect-specific retry policy. Long recurring processes use Continue-As-New.

## Consequences

- Positive: Temporal addresses durable orchestration where it adds clear value.
- Positive: Basic delivery correctness remains testable without distributed
  infrastructure.
- Negative: A later milestone must integrate and operate another critical service.
- Negative: Task state and Temporal history require explicit ownership and
  correlation to avoid dual truth.
- Follow-up: Do not implement a generic workflow DSL in the pre-Temporal ledger.

## Confirmation

- Pre-Temporal restart tests pass before Temporal packages enter the runtime.
- A multi-step workflow survives employee worker and pod replacement.
- Side-effecting Activity retries use stable idempotency keys or explicit
  reconciliation.
