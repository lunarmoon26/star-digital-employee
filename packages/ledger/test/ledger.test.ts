import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DurableLedger } from '../src/index.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  )
})

async function ledgerFile(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'star-ledger-'))
  temporaryDirectories.push(directory)
  return join(directory, 'ledger.sqlite')
}

describe('durable supervisor ledger', () => {
  it('commits an inbound envelope and its task atomically and survives restart', async () => {
    const path = await ledgerFile()
    const ledger = new DurableLedger(path)
    const accepted = ledger.acceptInbound({
      operationId: 'op-in-1',
      providerEventId: 'evt-1',
      channel: 'slack',
      account: 'acct-1',
      thread: 'C123',
      sender: 'U456',
      payload: { text: 'hello' },
    })
    expect(accepted.created).toBe(true)
    expect(accepted.inboxId).toBeGreaterThan(0)
    expect(accepted.taskId).toBeGreaterThan(0)
    ledger.close()

    // Reopen: the acknowledged envelope survives process replacement.
    const reopened = new DurableLedger(path)
    const inbox = reopened.inboxByOperation('op-in-1')
    expect(inbox?.providerEventId).toBe('evt-1')
    expect(inbox?.status).toBe('accepted')
    expect(inbox?.payload).toEqual({ text: 'hello' })
    reopened.close()
  })

  it('deduplicates a replayed provider operation id to one accepted operation', async () => {
    const path = await ledgerFile()
    const ledger = new DurableLedger(path)
    const envelope = {
      operationId: 'op-in-1',
      providerEventId: 'evt-1',
      channel: 'slack',
      account: 'acct-1',
      payload: { text: 'hello' },
    }
    const first = ledger.acceptInbound(envelope)
    const replay = ledger.acceptInbound(envelope)
    expect(first.created).toBe(true)
    expect(replay.created).toBe(false)
    expect(replay.inboxId).toBe(first.inboxId)
    expect(replay.taskId).toBe(first.taskId)
    ledger.close()
  })

  it('records ambiguous delivery as unknown and only reconciles explicitly', async () => {
    const path = await ledgerFile()
    const ledger = new DurableLedger(path)
    ledger.enqueueOutbound({
      operationId: 'op-out-1',
      channel: 'slack',
      account: 'acct-1',
      recipient: 'U456',
      payload: { text: 'hi' },
    })
    ledger.recordDelivery('op-out-1', { ambiguous: true })
    expect(ledger.outboxByOperation('op-out-1')?.status).toBe('unknown')
    expect(ledger.listPendingOutbox().map((row) => row.operationId)).toContain('op-out-1')

    ledger.reconcileDelivery('op-out-1', 'msg-1')
    const delivered = ledger.outboxByOperation('op-out-1')
    expect(delivered?.status).toBe('delivered')
    expect(delivered?.providerMessageId).toBe('msg-1')
    ledger.close()
  })

  it('keeps an effect unknown on ambiguity and never auto-completes it', async () => {
    const path = await ledgerFile()
    const ledger = new DurableLedger(path)
    ledger.beginEffect({ operationId: 'op-eff-1', target: 'send-email', payload: { to: 'a@b.c' } })
    ledger.markEffectUnknown('op-eff-1')
    expect(ledger.effectByOperation('op-eff-1')?.status).toBe('unknown')
    expect(ledger.listUnknownEffects().map((row) => row.operationId)).toEqual(['op-eff-1'])

    ledger.beginEffect({ operationId: 'op-eff-2', target: 'send-email', payload: {} })
    ledger.settleEffect('op-eff-2', 'completed')
    expect(ledger.effectByOperation('op-eff-2')?.status).toBe('completed')
    ledger.close()
  })

  it('links an approval to its effect and stamps the decision', async () => {
    const path = await ledgerFile()
    const ledger = new DurableLedger(path)
    ledger.beginEffect({ operationId: 'op-eff-1', target: 'send-email', payload: {} })
    const approvalId = ledger.requestApproval('op-eff-1')
    expect(ledger.approvalByEffect('op-eff-1')?.status).toBe('pending')
    ledger.resolveApproval(approvalId, 'approved', 'supervisor-1')
    expect(ledger.approvalByEffect('op-eff-1')?.status).toBe('approved')
    expect(ledger.effectByOperation('op-eff-1')?.decidedBy).toBe('supervisor-1')
    ledger.close()
  })
})
