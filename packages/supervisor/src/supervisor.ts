/**
 * Supervisor state machine: the durable bridge between channel envelopes and
 * the DeepSeek Harness. It commits inbound envelopes to the ledger before
 * acknowledgement, routes each conversation to one bridge-owned session,
 * submits an idempotent prompt, and commits outbound obligations from assistant
 * output. A `reconcile` pass resumes envelopes left incomplete by a crash.
 */

import type { DurableLedger, InboundEnvelope } from '@star/employee-ledger'
import { canonicalRouteKey } from './routing.js'
import type { BridgeApi } from './bridge-api.js'

export interface SupervisorOptions {
  /** Working directory handed to every bridge-created session. */
  cwd: string
}

export interface HandleInboundResult {
  status: 'processed' | 'duplicate'
  sessionId?: string
  outboxIds: number[]
}

export class Supervisor {
  readonly #ledger: DurableLedger
  readonly #bridge: BridgeApi
  readonly #cwd: string

  constructor(ledger: DurableLedger, bridge: BridgeApi, options: SupervisorOptions) {
    this.#ledger = ledger
    this.#bridge = bridge
    this.#cwd = options.cwd
  }

  /**
   * Accept and process one canonical inbound envelope. A replayed operation id
   * (provider retry) resolves to the already-accepted envelope: it is reported
   * duplicate when already completed, or resumed when it was left incomplete.
   */
  async handleInbound(envelope: InboundEnvelope): Promise<HandleInboundResult> {
    const accepted = this.#ledger.acceptInbound(envelope)
    if (!accepted.created) {
      const row = this.#ledger.inboxByOperation(envelope.operationId)
      if (row?.status === 'completed') return { status: 'duplicate', outboxIds: [] }
      return await this.#process(envelope.operationId)
    }
    return await this.#process(envelope.operationId)
  }

  /** Resume every envelope accepted but not yet completed (restart recovery). */
  async reconcile(): Promise<HandleInboundResult[]> {
    const results: HandleInboundResult[] = []
    for (const row of this.#ledger.listIncompleteInbox()) {
      results.push(await this.#process(row.operationId))
    }
    return results
  }

  async #process(operationId: string): Promise<HandleInboundResult> {
    const row = this.#ledger.inboxByOperation(operationId)
    if (row === undefined) throw new Error('supervisor: unknown inbox operation')

    const routeKey = canonicalRouteKey(row.channel, row.account, row.thread ?? undefined, row.sender ?? undefined)
    let sessionId = this.#ledger.routeFor(routeKey)
    if (sessionId === undefined) {
      const created = await this.#bridge.createSession(this.#cwd, `create:${routeKey}`)
      sessionId = created.sessionId
      this.#ledger.assignRoute(routeKey, sessionId)
    }
    this.#ledger.routeInbound(operationId, sessionId)

    const parsed = parsePayload(row.payload)
    const outboxIds: number[] = []
    if (parsed.text !== '') {
      const result = await this.#bridge.prompt(sessionId, parsed.text, `prompt:${operationId}`)
      for (const [index, message] of result.messages.entries()) {
        if (message.role !== 'assistant' || message.text === '') continue
        const outbound = this.#ledger.enqueueOutbound({
          operationId: `outbound:${operationId}:${index}`,
          channel: row.channel,
          account: row.account,
          recipient: parsed.replyTo ?? row.sender ?? row.thread ?? 'unknown',
          payload: {
            text: message.text,
            ...(parsed.threadId !== undefined ? { threadId: parsed.threadId } : {}),
          },
        })
        outboxIds.push(outbound.outboxId)
      }
    }

    this.#ledger.completeInbound(operationId)
    return { status: 'processed', sessionId, outboxIds }
  }
}

/** Pull the model-facing text and reply routing out of a normalized payload. */
function parsePayload(payload: unknown): { text: string; replyTo?: string; threadId?: string } {
  if (typeof payload === 'string') return { text: payload }
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>
    const text = typeof record['text'] === 'string' ? record['text'] : ''
    const replyTo = typeof record['replyTo'] === 'string' ? record['replyTo'] : undefined
    const threadId = typeof record['threadId'] === 'string' ? record['threadId'] : undefined
    return {
      text,
      ...(replyTo !== undefined ? { replyTo } : {}),
      ...(threadId !== undefined ? { threadId } : {}),
    }
  }
  return { text: '' }
}
