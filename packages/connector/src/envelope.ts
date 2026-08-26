/**
 * Canonical envelope normalization: provider events become ledger envelopes
 * with a stable operation id derived from the provider event identity, so a
 * provider retry resolves to one accepted envelope.
 */

import type { InboundEnvelope } from '@star/employee-ledger'
import type { NormalizedPayload } from './types.js'

/** Derive a stable operation id from the provider event identity. */
export function inboundOperationId(channel: string, account: string, providerEventId: string): string {
  return `${channel}:${account}:${providerEventId}`
}

/** Normalize one provider event into a canonical envelope. */
export function normalizeEnvelope(input: {
  channel: string
  account: string
  providerEventId: string
  thread?: string
  sender?: string
  text: string
  replyTo?: string
  threadId?: string
}): InboundEnvelope {
  const payload: NormalizedPayload = {
    text: input.text,
    ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
    ...(input.threadId !== undefined ? { threadId: input.threadId } : {}),
  }
  return {
    operationId: inboundOperationId(input.channel, input.account, input.providerEventId),
    providerEventId: input.providerEventId,
    channel: input.channel,
    account: input.account,
    ...(input.thread !== undefined ? { thread: input.thread } : {}),
    ...(input.sender !== undefined ? { sender: input.sender } : {}),
    payload,
  }
}

/** Read the model-facing text out of a normalized payload. */
export function textOf(payload: unknown): string {
  if (typeof payload === 'string') return payload
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    const text = (payload as Record<string, unknown>)['text']
    if (typeof text === 'string') return text
  }
  return ''
}

/** Read an optional string field out of a normalized payload. */
export function optionalField(payload: unknown, field: string): string | undefined {
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    const value = (payload as Record<string, unknown>)[field]
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}
