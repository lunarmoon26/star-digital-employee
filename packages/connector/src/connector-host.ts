/**
 * Generic connector host: owns the durable commit-before-acknowledge and
 * outbox-drain loops shared by every channel connector. The provider adapter
 * supplies `connect`/`deliver`/`disconnect`; this class supplies durability.
 */

import type { DeliveryResult, DurableLedger } from '@star/employee-ledger'
import { optionalField, textOf } from './envelope.js'
import type { ChannelConnector, OutboundMessage } from './types.js'

export class ConnectorHost {
  readonly #ledger: DurableLedger
  readonly #connector: ChannelConnector

  constructor(ledger: DurableLedger, connector: ChannelConnector) {
    this.#ledger = ledger
    this.#connector = connector
  }

  /** Start the provider feed; every event is committed before it is acknowledged. */
  async start(): Promise<void> {
    await this.#connector.connect((envelope) => {
      this.#ledger.acceptInbound(envelope)
    })
  }

  async stop(): Promise<void> {
    await this.#connector.disconnect()
  }

  /**
   * Drain this connector's pending outbox rows, delivering each obligation and
   * recording its outcome. A throwing delivery resolves to `unknown`, never to
   * a completed delivery.
   */
  async drainOutbox(): Promise<number> {
    let delivered = 0
    for (const row of this.#ledger.listPendingOutbox()) {
      if (row.channel !== this.#connector.channel) continue
      let result: DeliveryResult
      try {
        result = await this.#connector.deliver(outboundMessage(row))
      } catch {
        result = { ambiguous: true }
      }
      this.#ledger.recordDelivery(row.operationId, result)
      delivered += 1
    }
    return delivered
  }
}

function outboundMessage(row: {
  channel: string
  account: string
  recipient: string
  payload: unknown
}): OutboundMessage {
  const threadId = optionalField(row.payload, 'threadId')
  return {
    channel: row.channel,
    account: row.account,
    recipient: row.recipient,
    text: textOf(row.payload),
    ...(threadId !== undefined ? { threadId } : {}),
  }
}
