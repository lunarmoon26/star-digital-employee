import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appendLedgerRecord, readLedger } from '../src/ledger.js'
import { emptyRegistry, readRegistry, writeRegistry } from '../src/registry.js'

async function tempDirectory(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'star-bridge-'))
}

describe('bridge ownership registry', () => {
  it('round-trips an ownership index through an atomic write', async () => {
    const root = await tempDirectory()
    try {
      const path = join(root, 'sessions.json')
      const registry = {
        version: 1 as const,
        sessions: [{ sessionId: 'star-1', cwd: '/workspace', createdAt: 1, presetId: 'star-abc' }],
      }
      await writeRegistry(path, registry)
      expect(await readRegistry(path)).toEqual(registry)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('returns an empty registry for a missing file', async () => {
    const root = await tempDirectory()
    try {
      expect(await readRegistry(join(root, 'missing.json'))).toEqual(emptyRegistry())
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a malformed ownership index', async () => {
    const root = await tempDirectory()
    try {
      const path = join(root, 'sessions.json')
      await writeFile(path, '{"version":1,"sessions":[{"nope":true}]}', 'utf8')
      await expect(readRegistry(path)).rejects.toThrow(/invalid/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('bridge operation ledger', () => {
  it('appends records and retains only the bounded tail', async () => {
    const root = await tempDirectory()
    try {
      const path = join(root, 'operations.jsonl')
      let ledger = await readLedger(path, 2)
      expect(ledger).toEqual([])

      ledger = await appendLedgerRecord(path, {
        operationId: 'op-1',
        method: 'session/create',
        outcome: { ok: true, value: { sessionId: 'star-1' } },
      }, 2)
      ledger = await appendLedgerRecord(path, {
        operationId: 'op-2',
        method: 'session/prompt',
        outcome: { ok: true, value: { stopReason: 'end_turn', messages: [] } },
      }, 2)
      ledger = await appendLedgerRecord(path, {
        operationId: 'op-3',
        method: 'session/cancel',
        outcome: { ok: false, error: { code: 'not-found', message: 'missing' } },
      }, 2)

      expect(ledger.map(entry => entry.operationId)).toEqual(['op-2', 'op-3'])
      expect(await readLedger(path, 2)).toEqual(ledger)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('round-trips a recorded failure outcome', async () => {
    const root = await tempDirectory()
    try {
      const path = join(root, 'operations.jsonl')
      await appendLedgerRecord(path, {
        operationId: 'op-1',
        method: 'session/prompt',
        outcome: { ok: false, error: { code: 'not-found', message: 'session is not managed by the Star bridge' } },
      }, 8)
      const ledger = await readLedger(path, 8)
      expect(ledger).toHaveLength(1)
      expect(ledger[0]?.outcome).toEqual({
        ok: false,
        error: { code: 'not-found', message: 'session is not managed by the Star bridge' },
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
