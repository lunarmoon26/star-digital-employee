/**
 * Outcome verification contract (ADR 0014). A verifier decides whether a task's
 * collected evidence satisfies its success criteria, separate from "the agent
 * produced output". Runs in the supervisor trust domain, never inside DSH.
 */

/** Evidence a verifier evaluates against a task's success criteria. */
export interface VerificationContext {
  /** Canonical task operation id (ledger `tasks.operation_id`). */
  taskOperationId: string
  /** Success criteria; absent means "the agent stopped without error". */
  criteria: readonly string[]
  /** Collected assistant output and recorded effect/delivery outcomes. */
  evidence: {
    assistantText?: string
    effects: readonly { operationId: string; outcome: string }[]
    deliveries: readonly { operationId: string; outcome: string }[]
  }
}

/** One verification verdict. */
export type VerifyVerdict =
  | { kind: 'verified' }
  | { kind: 'failed'; reason: string }
  | { kind: 'needs-human'; reason: string }

/** A durable verification attempt (maps to the ledger `verifications` table). */
export interface VerificationRecord {
  verificationId: number
  taskOperationId: string
  attempt: number
  verdict: VerifyVerdict['kind']
  reason: string | null
  verifiedAt: number
}

/** A verifier: evaluates evidence against criteria. Swappable per domain. */
export interface Verifier {
  verify(context: VerificationContext): Promise<VerifyVerdict>
}

/** Escalation policy bounding retries before a human is asked. */
export interface EscalationPolicy {
  /** Maximum verification attempts before escalation. */
  maxAttempts: number
}

/** What the supervisor should do next after one verification. */
export type EscalationDecision =
  | { action: 'complete' }
  | { action: 'retry' }
  | { action: 'escalate'; reason: string }
