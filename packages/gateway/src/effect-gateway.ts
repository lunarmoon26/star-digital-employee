/**
 * Policy and effect gateway: records every external mutation before dispatch,
 * gates approval-required targets behind a human decision, and settles each
 * effect from its provider outcome. An ambiguous or throwing dispatch resolves
 * to `unknown`, never to a false `completed` (ADR 0003).
 */

import type { DurableLedger, EffectRecord } from '@star/employee-ledger'
import type { EffectPolicy } from './policy.js'

export interface EffectExecutorInput {
  target: string
  payload: unknown
  idempotencyKey?: string
}

/** Performs the actual external mutation. */
export interface EffectExecutor {
  execute(effect: EffectExecutorInput): Promise<{ providerId: string } | { ambiguous: true }>
}

export type ProposeResult =
  | { status: 'dispatched'; effectId: number; outcome: 'completed' | 'unknown' | 'failed' }
  | { status: 'pending-approval'; effectId: number; approvalId: number }

export class EffectGateway {
  readonly #ledger: DurableLedger
  readonly #executor: EffectExecutor
  readonly #policy: EffectPolicy

  constructor(ledger: DurableLedger, executor: EffectExecutor, policy: EffectPolicy) {
    this.#ledger = ledger
    this.#executor = executor
    this.#policy = policy
  }

  /**
   * Record and (when not approval-gated) dispatch one external mutation.
   * Replaying the same operation id returns the already-recorded effect state
   * without dispatching a second mutation.
   */
  async propose(effect: EffectRecord): Promise<ProposeResult> {
    const begun = this.#ledger.beginEffect(effect)
    if (!begun.created) return await this.#replayPropose(effect)
    if (this.#policy.requireApproval.has(effect.target)) {
      const approvalId = this.#ledger.requestApproval(effect.operationId)
      return { status: 'pending-approval', effectId: begun.effectId, approvalId }
    }
    const outcome = await this.#dispatch(effect.operationId, effect.target, effect.payload, effect.idempotencyKey)
    return { status: 'dispatched', effectId: begun.effectId, outcome }
  }

  /** Approve a pending effect and dispatch it. */
  async approve(approvalId: number, approver: string): Promise<{ outcome: 'completed' | 'unknown' }> {
    const effect = this.#pendingApprovalEffect(approvalId)
    this.#ledger.resolveApproval(approvalId, 'approved', approver)
    const outcome = await this.#dispatch(effect.operationId, effect.target, effect.payload, effect.idempotencyKey ?? undefined)
    return { outcome }
  }

  /** Reject a pending effect without dispatching it. */
  async reject(approvalId: number, approver: string): Promise<void> {
    const effect = this.#pendingApprovalEffect(approvalId)
    this.#ledger.resolveApproval(approvalId, 'rejected', approver)
    this.#ledger.settleEffect(effect.operationId, 'failed')
  }

  async #replayPropose(effect: EffectRecord): Promise<ProposeResult> {
    const existing = this.#ledger.effectByOperation(effect.operationId)
    if (existing === undefined) throw new Error('gateway: replayed effect is missing')
    if (existing.status === 'pending') {
      const approval = this.#ledger.approvalByEffect(effect.operationId)
      if (approval !== undefined && approval.status === 'pending') {
        return { status: 'pending-approval', effectId: existing.effectId, approvalId: approval.approvalId }
      }
      // Recorded but never dispatched (a crash between record and dispatch):
      // re-dispatch, relying on the executor idempotency key.
      const outcome = await this.#dispatch(effect.operationId, effect.target, effect.payload, effect.idempotencyKey)
      return { status: 'dispatched', effectId: existing.effectId, outcome }
    }
    return { status: 'dispatched', effectId: existing.effectId, outcome: existing.status }
  }

  async #dispatch(
    operationId: string,
    target: string,
    payload: unknown,
    idempotencyKey?: string,
  ): Promise<'completed' | 'unknown'> {
    try {
      const result = await this.#executor.execute({
        target,
        payload,
        ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
      })
      if ('ambiguous' in result) {
        this.#ledger.markEffectUnknown(operationId)
        return 'unknown'
      }
      this.#ledger.settleEffect(operationId, 'completed')
      return 'completed'
    } catch {
      this.#ledger.markEffectUnknown(operationId)
      return 'unknown'
    }
  }

  #pendingApprovalEffect(approvalId: number): NonNullable<ReturnType<DurableLedger['effectById']>> {
    const approval = this.#ledger.approvalById(approvalId)
    if (approval === undefined) throw new Error('gateway: unknown approval')
    if (approval.status !== 'pending') throw new Error('gateway: approval is not pending')
    const effect = this.#ledger.effectById(approval.effectId)
    if (effect === undefined) throw new Error('gateway: approval effect is missing')
    return effect
  }
}
