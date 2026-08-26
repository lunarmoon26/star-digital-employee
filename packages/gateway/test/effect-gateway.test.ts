import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DurableLedger } from '@star/employee-ledger'
import { EffectGateway, policyFromRecipe, type EffectExecutor, type EffectExecutorInput } from '../src/index.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  )
})

async function ledgerFile(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'star-gateway-'))
  temporaryDirectories.push(directory)
  return join(directory, 'ledger.sqlite')
}

class FakeExecutor implements EffectExecutor {
  executed: EffectExecutorInput[] = []
  results: ({ providerId: string } | { ambiguous: true })[] = []

  async execute(effect: EffectExecutorInput): Promise<{ providerId: string } | { ambiguous: true }> {
    this.executed.push(effect)
    return this.results.shift() ?? { providerId: `id-${this.executed.length}` }
  }
}

describe('effect gateway', () => {
  it('dispatches a non-gated effect and settles it completed', async () => {
    const ledger = new DurableLedger(await ledgerFile())
    const executor = new FakeExecutor()
    const gateway = new EffectGateway(ledger, executor, policyFromRecipe({ requireApproval: [] }))

    const result = await gateway.propose({ operationId: 'op-eff-1', target: 'send-email', payload: { to: 'a@b.c' } })
    expect(result).toEqual({ status: 'dispatched', effectId: expect.any(Number), outcome: 'completed' })
    expect(executor.executed).toHaveLength(1)
    expect(ledger.effectByOperation('op-eff-1')?.status).toBe('completed')
    ledger.close()
  })

  it('gates an approval-required effect until it is approved', async () => {
    const ledger = new DurableLedger(await ledgerFile())
    const executor = new FakeExecutor()
    const gateway = new EffectGateway(ledger, executor, policyFromRecipe({ requireApproval: ['send-email'] }))

    const proposed = await gateway.propose({ operationId: 'op-eff-1', target: 'send-email', payload: {} })
    expect(proposed.status).toBe('pending-approval')
    expect(executor.executed).toHaveLength(0)
    expect(ledger.effectByOperation('op-eff-1')?.status).toBe('pending')

    if (proposed.status !== 'pending-approval') throw new Error('expected pending approval')
    const approved = await gateway.approve(proposed.approvalId, 'supervisor-1')
    expect(approved.outcome).toBe('completed')
    expect(executor.executed).toHaveLength(1)
    expect(ledger.effectByOperation('op-eff-1')?.status).toBe('completed')
    expect(ledger.approvalByEffect('op-eff-1')?.status).toBe('approved')
    expect(ledger.approvalByEffect('op-eff-1')?.approver).toBe('supervisor-1')
    ledger.close()
  })

  it('rejects a gated effect without dispatching it', async () => {
    const ledger = new DurableLedger(await ledgerFile())
    const executor = new FakeExecutor()
    const gateway = new EffectGateway(ledger, executor, policyFromRecipe({ requireApproval: ['send-email'] }))

    const proposed = await gateway.propose({ operationId: 'op-eff-1', target: 'send-email', payload: {} })
    if (proposed.status !== 'pending-approval') throw new Error('expected pending approval')
    await gateway.reject(proposed.approvalId, 'supervisor-1')

    expect(executor.executed).toHaveLength(0)
    expect(ledger.effectByOperation('op-eff-1')?.status).toBe('failed')
    expect(ledger.approvalByEffect('op-eff-1')?.status).toBe('rejected')
    ledger.close()
  })

  it('records an ambiguous dispatch as unknown, never completed', async () => {
    const ledger = new DurableLedger(await ledgerFile())
    const executor = new FakeExecutor()
    executor.results.push({ ambiguous: true })
    const gateway = new EffectGateway(ledger, executor, policyFromRecipe({ requireApproval: [] }))

    const result = await gateway.propose({ operationId: 'op-eff-1', target: 'send-email', payload: {} })
    expect(result).toEqual({ status: 'dispatched', effectId: expect.any(Number), outcome: 'unknown' })
    expect(ledger.effectByOperation('op-eff-1')?.status).toBe('unknown')
    ledger.close()
  })

  it('replays a completed operation id without a second dispatch', async () => {
    const ledger = new DurableLedger(await ledgerFile())
    const executor = new FakeExecutor()
    const gateway = new EffectGateway(ledger, executor, policyFromRecipe({ requireApproval: [] }))

    const effect = { operationId: 'op-eff-1', target: 'send-email', payload: {} }
    const first = await gateway.propose(effect)
    const replay = await gateway.propose(effect)
    expect(first.status).toBe('dispatched')
    expect(replay).toEqual(first)
    expect(executor.executed).toHaveLength(1)
    ledger.close()
  })
})
