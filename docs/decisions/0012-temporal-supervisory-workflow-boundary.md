# 0012: Temporal Supervisory Workflow Boundary

Status: Accepted
Date: 2026-08-25

## Context

ADR 0005 deferred Temporal until the pre-Temporal ledger proved restart and
idempotency. That precondition now holds: the durable inbox/outbox/task/effect
ledger, supervisor, connector host, and effect gateway all commit with stable
operation ids and survive restart. Temporal can now own task-level orchestration
— durable waiting, timers, human signals, and worker recovery — without owning
DSH turns or transcripts.

## Decision Drivers

- One workflow per task or bounded business process, matching ADR 0005.
- DSH turns and connector effects stay Activities with stable operation ids,
  heartbeats, and effect-specific retry policy.
- Human approvals arrive as Signals/Updates, not as re-drivable model turns.
- Activity retries must never duplicate an ambiguous terminal effect.

## Options Considered

### Wrap every model step in a workflow

This duplicates DSH session ownership and forces arbitrary external effects into
an exactly-once model they cannot satisfy. Rejected.

### Keep Temporal out entirely

Durable waiting, timers, and worker recovery would be reimplemented by hand.
Rejected.

### Task workflows over the existing ledger

Temporal coordinates tasks; the ledger remains the system of record for inbox,
outbox, effects, and approvals. Accepted.

## Decision

Temporal runs `TaskWorkflow`s that orchestrate the existing supervisor state
machine through idempotent Activities:

- `process-task` routes an accepted envelope to one bridge-owned DSH session and
  submits the prompt (operation id = `prompt:<taskOperationId>`).
- `deliver-outbox` performs one connector delivery and records its outcome
  (`delivered` or `unknown`).
- `execute-effect` dispatches one approval-cleared effect and settles it
  (`completed`, `failed`, or `unknown`).
- `request-approval` waits for a human decision delivered as a Signal/Update
  (`approve`/`reject`), then resumes the workflow.

Every Activity's idempotency key is derived from its stable operation id, so an
at-least-once retry resolves to the already-recorded operation. Long-running
turns report heartbeats; delivery and effect Activities use effect-specific
retry policies that never auto-retry an ambiguous outcome into a duplicate.
Long recurring processes use Continue-As-New.

## Consequences

- Positive: Durable waiting, schedules, and worker recovery come from a mature
  engine while the ledger remains the source of truth.
- Positive: The contract is fakes-testable before a Temporal server exists.
- Negative: A new critical service (Temporal) must be operated and upgraded.
- Negative: Task state and Temporal history must be correlated to the ledger by
  operation id to avoid dual truth.

## Confirmation

- `process-task`, `deliver-outbox`, and `execute-effect` derive their idempotency
  keys from stable operation ids.
- Retry policies never retry an ambiguous delivery into a duplicate.
- A multi-step approved task workflow survives worker and pod replacement.
