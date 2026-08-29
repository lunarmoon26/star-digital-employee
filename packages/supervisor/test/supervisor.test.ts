import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { BridgePromptResult } from '@star/employee-bridge'
import { DurableLedger } from '@star/employee-ledger'
import type { Verifier, VerifyVerdict } from '@star/employee-verifier'
import type { BridgeApi, CreatedSession } from '../src/index.js'
import { Supervisor } from '../src/index.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  )
})

async function ledgerFile(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'star-supervisor-'))
  temporaryDirectories.push(directory)
  return join(directory, 'ledger.sqlite')
}

interface PromptCall {
  sessionId: string
  text: string
  operationId: string
}

/** A fake bridge that reproduces the operation-id dedup the real socket has. */
class FakeBridge implements BridgeApi {
  sessionCount = 0
  promptCalls: PromptCall[] = []
  readonly #sessionsByOperation = new Map<string, string>()
  readonly #promptResults = new Map<string, BridgePromptResult>()

  async createSession(_cwd: string, operationId: string): Promise<CreatedSession> {
    const existing = this.#sessionsByOperation.get(operationId)
    if (existing !== undefined) return { sessionId: existing }
    this.sessionCount += 1
    const sessionId = `star-${this.sessionCount}`
    this.#sessionsByOperation.set(operationId, sessionId)
    return { sessionId }
  }

  async prompt(sessionId: string, text: string, operationId: string): Promise<BridgePromptResult> {
    const existing = this.#promptResults.get(operationId)
    if (existing !== undefined) return existing
    this.promptCalls.push({ sessionId, text, operationId })
    const result: BridgePromptResult = {
      stopReason: 'end_turn',
      messages: [{ role: 'assistant', text: `reply to: ${text}` }],
    }
    this.#promptResults.set(operationId, result)
    return result
  }

  async resumeSession(sessionId: string): Promise<{ sessionId: string }> {
    return { sessionId }
  }
}

function envelope(operationId: string, thread: string, text: string) {
  return {
    operationId,
    providerEventId: `evt-${operationId}`,
    channel: 'slack',
    account: 'acct-1',
    thread,
    sender: 'U1',
    payload: { text },
  }
}

describe('supervisor state machine', () => {
  it('processes an envelope into a routed session and an outbound obligation', async () => {
    const path = await ledgerFile()
    const ledger = new DurableLedger(path)
    const bridge = new FakeBridge()
    const supervisor = new Supervisor(ledger, bridge, { cwd: '/workspace' })

    const result = await supervisor.handleInbound(envelope('op-1', 'C1', 'hello'))
    expect(result.status).toBe('processed')
    expect(result.sessionId).toBe('star-1')
    expect(result.outboxIds).toHaveLength(1)
    expect(bridge.promptCalls).toEqual([{ sessionId: 'star-1', text: 'hello', operationId: 'prompt:op-1' }])

    const outbox = ledger.outboxByOperation('outbound:op-1:0')
    expect(outbox?.channel).toBe('slack')
    expect(outbox?.recipient).toBe('U1')
    expect(outbox?.payload).toEqual({ text: 'reply to: hello' })
    expect(ledger.inboxByOperation('op-1')?.status).toBe('completed')
    ledger.close()
  })

  it('routes one thread to one session and deduplicates a replayed envelope', async () => {
    const path = await ledgerFile()
    const ledger = new DurableLedger(path)
    const bridge = new FakeBridge()
    const supervisor = new Supervisor(ledger, bridge, { cwd: '/workspace' })

    const first = await supervisor.handleInbound(envelope('op-1', 'C1', 'one'))
    const second = await supervisor.handleInbound(envelope('op-2', 'C1', 'two'))
    expect(first.sessionId).toBe('star-1')
    expect(second.sessionId).toBe('star-1')
    expect(bridge.sessionCount).toBe(1)

    const replay = await supervisor.handleInbound(envelope('op-1', 'C1', 'one'))
    expect(replay.status).toBe('duplicate')
    expect(bridge.promptCalls.map((call) => call.operationId)).toEqual(['prompt:op-1', 'prompt:op-2'])
    ledger.close()
  })

  it('recovers an accepted-but-unprocessed envelope after restart', async () => {
    const path = await ledgerFile()
    const bridge = new FakeBridge()
    // Simulate a connector that committed the envelope, then crashed before the
    // supervisor processed it.
    const before = new DurableLedger(path)
    before.acceptInbound(envelope('op-1', 'C1', 'recover me'))
    before.close()

    // Restart: a fresh ledger and supervisor reconcile the stuck envelope.
    const reopened = new DurableLedger(path)
    const supervisor = new Supervisor(reopened, bridge, { cwd: '/workspace' })
    const results = await supervisor.reconcile()
    expect(results).toHaveLength(1)
    expect(results[0]?.status).toBe('processed')
    expect(bridge.promptCalls).toHaveLength(1)
    expect(reopened.inboxByOperation('op-1')?.status).toBe('completed')
    reopened.close()
  })

  it('does not re-prompt after a crash between prompt and completion', async () => {
    const path = await ledgerFile()
    const bridge = new FakeBridge()
    // First supervisor processes and completes the envelope.
    const first = new DurableLedger(path)
    await new Supervisor(first, bridge, { cwd: '/workspace' }).handleInbound(envelope('op-1', 'C1', 'once'))
    first.close()

    // A fresh supervisor reconciles: the envelope is already completed, so the
    // prompt operation id must dedup instead of running a second turn.
    const reopened = new DurableLedger(path)
    const results = await new Supervisor(reopened, bridge, { cwd: '/workspace' }).reconcile()
    expect(results).toHaveLength(0)
    expect(bridge.promptCalls).toHaveLength(1)
    reopened.close()
  })
})

class FakeVerifier implements Verifier {
  verdicts: VerifyVerdict[] = []

  async verify(): Promise<VerifyVerdict> {
    return this.verdicts.shift() ?? { kind: 'verified' }
  }
}

describe('supervisor outcome verification', () => {
  it('completes a task on a verified verdict', async () => {
    const ledger = new DurableLedger(await ledgerFile())
    const bridge = new FakeBridge()
    const verifier = new FakeVerifier()
    verifier.verdicts.push({ kind: 'verified' })
    const supervisor = new Supervisor(ledger, bridge, { cwd: '/workspace', verifier })

    const result = await supervisor.handleInbound(envelope('op-1', 'C1', 'hello'))
    expect(result.status).toBe('processed')
    expect(ledger.inboxByOperation('op-1')?.status).toBe('completed')
    expect(ledger.verificationAttempts('op-1').map((attempt) => attempt.verdict)).toEqual(['verified'])
    ledger.close()
  })

  it('parks a retryable failed verdict for a later attempt', async () => {
    const ledger = new DurableLedger(await ledgerFile())
    const bridge = new FakeBridge()
    const verifier = new FakeVerifier()
    verifier.verdicts.push({ kind: 'failed', reason: 'bad output' })
    const supervisor = new Supervisor(ledger, bridge, {
      cwd: '/workspace',
      verifier,
      escalationPolicy: { maxAttempts: 3 },
    })

    const result = await supervisor.handleInbound(envelope('op-1', 'C1', 'hello'))
    expect(result.status).toBe('needs-retry')
    expect(ledger.inboxByOperation('op-1')?.status).toBe('verifying')
    ledger.close()
  })

  it('escalates when the retry bound is exhausted', async () => {
    const ledger = new DurableLedger(await ledgerFile())
    const bridge = new FakeBridge()
    const verifier = new FakeVerifier()
    verifier.verdicts.push({ kind: 'failed', reason: 'still wrong' })
    const supervisor = new Supervisor(ledger, bridge, {
      cwd: '/workspace',
      verifier,
      escalationPolicy: { maxAttempts: 1 },
    })

    const result = await supervisor.handleInbound(envelope('op-1', 'C1', 'hello'))
    expect(result.status).toBe('escalated')
    expect(ledger.inboxByOperation('op-1')?.status).toBe('needs-human')
    ledger.close()
  })

  it('escalates immediately on a needs-human verdict', async () => {
    const ledger = new DurableLedger(await ledgerFile())
    const bridge = new FakeBridge()
    const verifier = new FakeVerifier()
    verifier.verdicts.push({ kind: 'needs-human', reason: 'ambiguous identity' })
    const supervisor = new Supervisor(ledger, bridge, { cwd: '/workspace', verifier })

    const result = await supervisor.handleInbound(envelope('op-1', 'C1', 'hello'))
    expect(result.status).toBe('escalated')
    expect(ledger.inboxByOperation('op-1')?.status).toBe('needs-human')
    ledger.close()
  })
})
