/**
 * Slack Socket Mode connector: normalizes message events into canonical
 * envelopes, commits each before acknowledging, and delivers replies through a
 * narrow web-client surface. The socket and web clients are interfaces so the
 * connector is testable without the Slack SDKs and credentials (ADR 0006).
 */

import type { InboundEnvelope } from '@star/employee-ledger'
import { normalizeEnvelope } from './envelope.js'
import type { ChannelConnector, OutboundMessage } from './types.js'

/** The subset of a Slack `message` event the connector consumes. */
export interface SlackMessageEvent {
  type: string
  channel?: string
  user?: string
  thread_ts?: string
  ts?: string
  text?: string
  client_msg_id?: string
}

/** The subset of `@slack/socket-mode` the connector uses. */
export interface SlackSocketModeClient {
  on(
    event: string,
    handler: (payload: { ack: () => Promise<void>; event: SlackMessageEvent }) => void,
  ): void
  start(): Promise<void>
  disconnect(): Promise<void>
}

/** The subset of `@slack/web-api` the connector uses for delivery. */
export interface SlackWebClient {
  postMessage(input: { channel: string; text: string; thread_ts?: string }): Promise<{ ts: string }>
}

/** Normalize one Slack message event into a canonical envelope. */
export function slackEventToEnvelope(event: SlackMessageEvent, account: string): InboundEnvelope | undefined {
  if (event.type !== 'message') return undefined
  const text = event.text
  if (typeof text !== 'string' || text === '') return undefined
  const providerEventId = event.client_msg_id ?? event.ts ?? ''
  if (providerEventId === '') return undefined
  const thread = event.thread_ts ?? event.ts
  const sender = event.user
  const replyTo = event.channel
  return normalizeEnvelope({
    channel: 'slack',
    account,
    providerEventId,
    text,
    ...(thread !== undefined ? { thread } : {}),
    ...(sender !== undefined ? { sender } : {}),
    ...(replyTo !== undefined ? { replyTo } : {}),
    ...(thread !== undefined ? { threadId: thread } : {}),
  })
}

/** Slack Socket Mode connector backed by injectable socket and web clients. */
export class SlackSocketModeConnector implements ChannelConnector {
  readonly channel = 'slack'

  constructor(
    private readonly socket: SlackSocketModeClient,
    private readonly web: SlackWebClient,
    private readonly account: string,
  ) {}

  async connect(commit: (envelope: InboundEnvelope) => Promise<void> | void): Promise<void> {
    this.socket.on('slack_event', async ({ ack, event }) => {
      const envelope = slackEventToEnvelope(event, this.account)
      if (envelope !== undefined) await commit(envelope)
      await ack()
    })
    await this.socket.start()
  }

  async deliver(message: OutboundMessage): Promise<{ providerMessageId: string } | { ambiguous: true }> {
    try {
      const result = await this.web.postMessage({
        channel: message.recipient,
        text: message.text,
        ...(message.threadId !== undefined ? { thread_ts: message.threadId } : {}),
      })
      return { providerMessageId: result.ts }
    } catch {
      return { ambiguous: true }
    }
  }

  async disconnect(): Promise<void> {
    await this.socket.disconnect()
  }
}
