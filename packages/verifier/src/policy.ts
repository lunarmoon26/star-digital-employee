/**
 * Escalation decision logic (ADR 0014): turn one verdict plus the attempt count
 * into the supervisor's next action.
 */

import type { EscalationDecision, EscalationPolicy, VerifyVerdict } from './types.js'

/** Decide the next action after a verification verdict. */
export function decideNext(
  verdict: VerifyVerdict,
  attempt: number,
  policy: EscalationPolicy,
): EscalationDecision {
  switch (verdict.kind) {
    case 'verified':
      return { action: 'complete' }
    case 'needs-human':
      return { action: 'escalate', reason: verdict.reason }
    case 'failed':
      return attempt >= policy.maxAttempts
        ? { action: 'escalate', reason: `verification failed after ${attempt} attempt(s): ${verdict.reason}` }
        : { action: 'retry' }
  }
}
