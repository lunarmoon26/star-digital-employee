/**
 * Gmail connector (googleapis + OAuth client). It polls one mailbox, normalizes
 * messages into canonical envelopes, and sends plain-text replies with thread
 * correlation. The OAuth client is injected so credentials stay at the process
 * boundary (ADR 0006).
 */

import { type gmail_v1 } from 'googleapis'
import type { InboundEnvelope } from '@star/employee-ledger'
import { normalizeEnvelope } from './envelope.js'
import type { ChannelConnector, OutboundMessage } from './types.js'

/** The Gmail message fields the connector consumes. */
export interface GmailMessage {
  id?: string | null
  threadId?: string | null
  snippet?: string | null
  payload?: {
    headers?: { name?: string | null; value?: string | null }[] | null
  } | null
}

/** Normalize one Gmail message into a canonical envelope (reply-to = From). */
export function gmailMessageToEnvelope(
  message: GmailMessage,
  account: string,
): InboundEnvelope | undefined {
  if (typeof message.id !== 'string' || message.id === '') return undefined
  const from = headerValue(message.payload?.headers, 'From')
  const text = message.snippet ?? ''
  if (text === '') return undefined
  const thread = message.threadId ?? undefined
  return normalizeEnvelope({
    channel: 'gmail',
    account,
    providerEventId: message.id,
    text,
    ...(thread !== undefined ? { thread } : {}),
    ...(from !== undefined ? { sender: from } : {}),
    ...(from !== undefined ? { replyTo: from } : {}),
    ...(thread !== undefined ? { threadId: thread } : {}),
  })
}

export interface GmailConnectorOptions {
  gmail: gmail_v1.Gmail
  /** Mailbox to monitor and send from (an email address or `me`). */
  userId: string
  /** Tenant label, for example the Workspace domain. */
  account: string
  pollIntervalMs?: number
}

/** Poll-based Gmail connector with plain-text threaded replies. */
export class GmailConnector implements ChannelConnector {
  readonly channel = 'gmail'
  readonly #gmail: gmail_v1.Gmail
  readonly #userId: string
  readonly #account: string
  readonly #pollIntervalMs: number
  #timer: NodeJS.Timeout | undefined

  constructor(options: GmailConnectorOptions) {
    this.#gmail = options.gmail
    this.#userId = options.userId
    this.#account = options.account
    this.#pollIntervalMs = options.pollIntervalMs ?? 60_000
  }

  async connect(commit: (envelope: InboundEnvelope) => Promise<void> | void): Promise<void> {
    const poll = async (): Promise<void> => {
      const list = await this.#gmail.users.messages.list({
        userId: this.#userId,
        q: 'is:unread',
        maxResults: 25,
      })
      for (const reference of list.data.messages ?? []) {
        if (reference.id === undefined || reference.id === null) continue
        try {
          const fetched = await this.#gmail.users.messages.get({
            userId: this.#userId,
            id: reference.id,
            format: 'metadata',
            metadataHeaders: ['From'],
          })
          const envelope = gmailMessageToEnvelope(fetched.data, this.#account)
          if (envelope !== undefined) await commit(envelope)
        } catch {
          // A transient read failure is retried on the next poll.
        }
      }
    }
    await poll()
    this.#timer = setInterval(() => { void poll().catch(() => {}) }, this.#pollIntervalMs)
  }

  async deliver(message: OutboundMessage): Promise<{ providerMessageId: string } | { ambiguous: true }> {
    try {
      const response = await this.#gmail.users.messages.send({
        userId: this.#userId,
        requestBody: { raw: buildEmailRaw(this.#userId, message.recipient, message.text, message.threadId) },
      })
      if (response.data.id === undefined || response.data.id === null) return { ambiguous: true }
      return { providerMessageId: response.data.id }
    } catch {
      return { ambiguous: true }
    }
  }

  async disconnect(): Promise<void> {
    if (this.#timer !== undefined) clearInterval(this.#timer)
  }
}

function headerValue(
  headers: { name?: string | null; value?: string | null }[] | null | undefined,
  name: string,
): string | undefined {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined
}

/** Build a base64url MIME email with thread correlation headers. */
function buildEmailRaw(from: string, to: string, text: string, threadId?: string): string {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    'Subject: Re: message',
    ...(threadId !== undefined ? [`In-Reply-To: <${threadId}>`, `References: <${threadId}>`] : []),
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    text,
  ]
  return Buffer.from(headers.join('\r\n'), 'utf8').toString('base64url')
}
