import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DurableLedger, type DeliveryResult, type InboundEnvelope } from '@star/employee-ledger'
import { ConnectorHost } from '../src/index.js'
import type { ChannelConnector, OutboundMessage } from '../src/index.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  )
})

async function ledgerFile(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'star-connector-'))
  temporaryDirectories.push(directory)
  return join(directory, 'ledger.sqlite')
}

class FakeConnector implements ChannelConnector {
  readonly channel = 'slack'
  committed: InboundEnvelope[] = []
  delivered: OutboundMessage[] = []
  deliveryResult: DeliveryResult = { ambiguous: true }
  #commit: ((envelope: InboundEnvelope) => Promise<void> | void) | undefined

  async connect(commit: (envelope: InboundEnvelope) => Promise<void> | void): Promise<void> {
    this.#commit = commit
  }

  async receive(envelope: InboundEnvelope): Promise<void> {
    await this.#commit?.(envelope)
  }

  async deliver(message: OutboundMessage): Promise<DeliveryResult> {
    this.delivered.push(message)
    return this.deliveryResult
  }

  async disconnect(): Promise<void> {}
}

describe('connector host', () => {
  it('commits an inbound envelope through the connector feed', async () => {
    const path = await ledgerFile()
    const ledger = new DurableLedger(path)
    const connector = new FakeConnector()
    const host = new ConnectorHost(ledger, connector)
    await host.start()

    await connector.receive({
      operationId: 'slack:acct-1:evt-1',
      providerEventId: 'evt-1',
      channel: 'slack',
      account: 'acct-1',
      thread: 'T1',
      payload: { text: 'hello' },
    })

    expect(ledger.inboxByOperation('slack:acct-1:evt-1')?.providerEventId).toBe('evt-1')
    ledger.close()
  })

  it('drains the outbox and records ambiguous delivery as unknown', async () => {
    const path = await ledgerFile()
    const ledger = new DurableLedger(path)
    ledger.enqueueOutbound({
      operationId: 'out-1',
      channel: 'slack',
      account: 'acct-1',
      recipient: 'C1',
      payload: { text: 'hi', threadId: 'T1' },
    })
    ledger.enqueueOutbound({
      operationId: 'out-2',
      channel: 'slack',
      account: 'acct-1',
      recipient: 'C1',
      payload: { text: 'again' },
    })
    const connector = new FakeConnector()
    connector.deliveryResult = { ambiguous: true }
    const host = new ConnectorHost(ledger, connector)

    const count = await host.drainOutbox()
    expect(count).toBe(2)
    expect(connector.delivered).toHaveLength(2)
    expect(connector.delivered[0]?.text).toBe('hi')
    expect(connector.delivered[0]?.threadId).toBe('T1')
    expect(ledger.outboxByOperation('out-1')?.status).toBe('unknown')
    expect(ledger.outboxByOperation('out-2')?.status).toBe('unknown')
    ledger.close()
  })

  it('records a successful delivery with the provider message id', async () => {
    const path = await ledgerFile()
    const ledger = new DurableLedger(path)
    ledger.enqueueOutbound({
      operationId: 'out-1',
      channel: 'slack',
      account: 'acct-1',
      recipient: 'C1',
      payload: { text: 'hi' },
    })
    const connector = new FakeConnector()
    connector.deliveryResult = { providerMessageId: 'msg-1' }
    const host = new ConnectorHost(ledger, connector)

    await host.drainOutbox()
    const row = ledger.outboxByOperation('out-1')
    expect(row?.status).toBe('delivered')
    expect(row?.providerMessageId).toBe('msg-1')
    ledger.close()
  })
})
