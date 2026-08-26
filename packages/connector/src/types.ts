/**
 * Channel connector contract. A connector is a provider adapter that owns its
 * credentials (ADR 0006), normalizes provider events into canonical envelopes,
 * commits them before acknowledgement, and performs scoped delivery without
 * exposing its credentials to the Harness.
 */

import type { DeliveryResult, InboundEnvelope } from '@star/employee-ledger'

/** One outbound obligation, projected for a provider's delivery call. */
export interface OutboundMessage {
  channel: string
  account: string
  /** Provider destination (for example a Slack channel id or an email address). */
  recipient: string
  text: string
  /** Optional conversation thread identity, preserved for a threaded reply. */
  threadId?: string
}

/** A provider adapter for one channel (for example Slack Socket Mode or Gmail). */
export interface ChannelConnector {
  /** Provider channel this connector serves, matched against outbox rows. */
  readonly channel: string
  /**
   * Start the provider feed. The `commit` callback must be awaited before the
   * provider event is acknowledged, so an accepted envelope is durable before
   * the provider stops retrying it.
   */
  connect(commit: (envelope: InboundEnvelope) => Promise<void> | void): Promise<void>
  /** Deliver one outbound message, returning the provider id or an ambiguous outcome. */
  deliver(message: OutboundMessage): Promise<DeliveryResult>
  /** Stop the provider feed and release provider-owned resources. */
  disconnect(): Promise<void>
}

/**
 * Canonical normalized payload carried by a connector envelope. The ledger and
 * supervisor treat it as opaque JSON; connectors and the outbox pump read these
 * fields to route and thread replies.
 */
export interface NormalizedPayload {
  /** Model-facing message text. */
  text: string
  /** Provider reply target (for example a Slack channel id). */
  replyTo?: string
  /** Provider conversation thread identity. */
  threadId?: string
}
