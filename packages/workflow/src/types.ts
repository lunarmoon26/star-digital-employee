/**
 * Temporal supervisory workflow contract (ADR 0012). One workflow coordinates
 * one task over the existing ledger. These are plain types — the `@temporalio/*`
 * SDK maps each to a workflow, activity, signal, or update — so the boundary is
 * fakes-testable before a Temporal server exists.
 */

/** One workflow = one task (or bounded process). */
export interface TaskWorkflowInput {
  taskOperationId: string
}

export interface TaskWorkflowOutput {
  status: 'completed' | 'failed'
}

/** Route + prompt one accepted envelope (idempotent via the bridge ledger). */
export interface ProcessTaskActivityInput {
  taskOperationId: string
}

export interface ProcessTaskActivityOutput {
  sessionId: string
}

/** Deliver one outbox obligation (idempotent; ambiguity stays `unknown`). */
export interface DeliverOutboxActivityInput {
  outboxOperationId: string
}

export interface DeliverOutboxActivityOutput {
  outcome: 'delivered' | 'unknown'
}

/** Dispatch one approval-cleared effect (idempotent; ambiguity stays `unknown`). */
export interface ExecuteEffectActivityInput {
  effectOperationId: string
}

export interface ExecuteEffectActivityOutput {
  outcome: 'completed' | 'failed' | 'unknown'
}

/** A human approval decision, delivered as a Temporal Signal or Update. */
export interface ApprovalDecision {
  approvalId: number
  decision: 'approved' | 'rejected'
  approver: string
}

/** A blocking approval request issued by the workflow while it waits. */
export interface RequestApprovalInput {
  approvalId: number
  target: string
}

export interface RequestApprovalOutput {
  decision: 'approved' | 'rejected'
}

/** The idempotent, at-least-once Activities a task workflow drives. */
export type ActivityKind = 'process-task' | 'deliver-outbox' | 'execute-effect'

/** Retry policy for one Activity kind. */
export interface RetryPolicy {
  initialIntervalMs: number
  backoff: number
  maxAttempts: number
}

/** Heartbeat details reported during a long-running Activity. */
export interface HeartbeatDetails {
  operationId: string
  note: string
}
