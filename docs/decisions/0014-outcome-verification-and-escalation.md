# 0014: Outcome Verification and Escalation

Status: Accepted
Date: 2026-08-26

## Context

The durable ledger records *that* an effect happened (`completed`, `failed`,
`unknown`), but not *whether the work satisfied the task*. DeepSeek Harness
decides completion ad-hoc inside its own turn, so the supervisor cannot observe
or retry a task that "finished" but produced the wrong result, and cannot decide
when to hand a task to a human.

## Decision Drivers

- Separate "the agent produced output" from "the output meets the task".
- Make retry and escalation explicit, observable, and durable.
- Reuse the existing approvals and operation-id machinery rather than adding a
  new trust boundary.

## Options Considered

### Trust the agent's own stop condition

Simplest, but hides wrong-output failure inside the transcript. Rejected.

### Verify inside DeepSeek Harness

DSH already decides turns; adding a second verdict there couples verification
to a code-execution surface. Rejected.

### A supervisor-owned verifier stage

A typed `Verifier` evaluates a task's evidence against its success criteria and
returns a verdict; the supervisor records the verdict and applies an escalation
policy. Accepted.

## Decision

Add a verification stage between executor and approval:

1. A `Verifier` contract evaluates a `VerificationContext` (task operation id,
   success criteria, and collected evidence — assistant output plus the recorded
   effect and delivery outcomes) and returns a `VerifyVerdict`: `verified`,
   `failed` (retryable), or `needs-human`.
2. The ledger records each verification attempt (`verifications`: task operation
   id, attempt number, verdict, reason) so retry and escalation are auditable.
3. An `EscalationPolicy` bounds retries: `verified` completes the task; a
   retryable `failed` verdict retries up to `maxAttempts`, then escalates;
   `needs-human` escalates immediately. Budget exhaustion and idle timeout also
   escalate, using the recipe's `budget` and `idleTimeoutMinutes` plus the
   existing approval ledger.

Verifiers are swappable (rule-based, model-based, or domain-specific) and run in
the supervisor trust domain, never inside the Harness.

## Consequences

- Positive: wrong-output failure becomes an explicit, retryable, auditable state.
- Positive: escalation thresholds are policy, not buried in a model turn.
- Negative: each task needs success criteria; tasks without criteria degrade to
  "the agent stopped without error", which stays the current behavior.
- Negative: a model-based verifier costs an extra model call per attempt.

## Confirmation

- `verified` completes the task; a retryable `failed` verdict retries and is
  recorded per attempt; `needs-human` and exhausted retries open an escalation.
- Verification attempts survive restart and are correlated by task operation id.
