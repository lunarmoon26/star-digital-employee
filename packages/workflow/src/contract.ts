/**
 * Activity idempotency and retry mapping. Every Activity derives its idempotency
 * key from a stable operation id, and its retry policy never re-runs an
 * ambiguous terminal effect (ADR 0003, ADR 0012).
 */

import type { ActivityKind, HeartbeatDetails, RetryPolicy } from './types.js'

/** Derive the idempotency key an Activity must use. */
export function activityIdempotencyKey(kind: ActivityKind, operationId: string): string {
  switch (kind) {
    case 'process-task':
      // Matches the supervisor's bridge prompt operation id.
      return `prompt:${operationId}`
    case 'deliver-outbox':
    case 'execute-effect':
      // Matches the ledger's outbox/effect operation id.
      return operationId
  }
}

/**
 * Retry policy per Activity kind. Prompt turns are idempotent through the bridge
 * operation-id ledger and may retry; delivery and effect dispatch must never
 * auto-retry an ambiguous outcome into a duplicate.
 */
export function retryPolicyFor(kind: ActivityKind): RetryPolicy {
  switch (kind) {
    case 'process-task':
      return { initialIntervalMs: 1_000, backoff: 2, maxAttempts: 5 }
    case 'deliver-outbox':
    case 'execute-effect':
      return { initialIntervalMs: 0, backoff: 1, maxAttempts: 1 }
  }
}

/** Heartbeat details for a long-running Activity. */
export function heartbeatDetailsFor(operationId: string, note: string): HeartbeatDetails {
  return { operationId, note }
}
