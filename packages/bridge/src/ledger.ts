/**
 * Bounded operation-id ledger. It records the terminal outcome of completed
 * mutating operations so a replayed request returns the recorded result instead
 * of re-executing. The ledger is append-only JSONL with atomic compaction once
 * it exceeds its configured record bound.
 */

import { appendFile, chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { isMutatingMethod, type BridgeMethod, type OperationRecord } from './protocol.js'

/**
 * Read the ledger, returning only the most recent `maxRecords` valid entries.
 * @param path - Absolute ledger file path.
 * @param maxRecords - Maximum records to retain.
 */
export async function readLedger(path: string, maxRecords: number): Promise<OperationRecord[]> {
  let source: string
  try {
    source = await readFile(path, 'utf8')
  } catch (error) {
    if (isMissing(error)) return []
    throw error
  }
  const records: OperationRecord[] = []
  for (const line of source.split('\n')) {
    if (line === '') continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      throw new Error(`star-bridge: operation ledger ${JSON.stringify(path)} contains an invalid line`)
    }
    if (!isOperationRecord(value)) {
      throw new Error(`star-bridge: operation ledger ${JSON.stringify(path)} contains an invalid record`)
    }
    records.push(value)
  }
  return records.slice(-maxRecords)
}

/**
 * Append one record, fsync it, and compact the ledger to its bound when needed.
 * @param path - Absolute ledger file path.
 * @param record - Recorded completed operation.
 * @param maxRecords - Maximum records to retain.
 * @returns the complete retained ledger after the append.
 */
export async function appendLedgerRecord(
  path: string,
  record: OperationRecord,
  maxRecords: number,
): Promise<OperationRecord[]> {
  const next = [...(await readLedger(path, maxRecords)), record]
  await appendLine(path, record)
  if (next.length > maxRecords) {
    await rewriteLedger(path, next.slice(-maxRecords))
  }
  return next.slice(-maxRecords)
}

/** Append one JSONL line and force it to disk before returning. */
async function appendLine(path: string, record: OperationRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await appendFile(path, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'a' })
  await chmod(path, 0o600)
}

/** Atomically rewrite the ledger with a bounded record list. */
async function rewriteLedger(path: string, records: readonly OperationRecord[]): Promise<void> {
  const temporary = `${path}.star-${process.pid}`
  await writeFile(
    temporary,
    records.map(record => `${JSON.stringify(record)}`).join('\n') + (records.length > 0 ? '\n' : ''),
    { mode: 0o600, flag: 'w' },
  )
  await chmod(temporary, 0o600)
  await rename(temporary, path)
  await chmod(path, 0o600)
}

/** Whether a value is a well-formed operation ledger record. */
function isOperationRecord(value: unknown): value is OperationRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (typeof record['operationId'] !== 'string' || record['operationId'] === '') return false
  if (typeof record['method'] !== 'string' || !isMutatingMethod(record['method'] as BridgeMethod)) return false
  const outcome = record['outcome']
  if (typeof outcome !== 'object' || outcome === null || Array.isArray(outcome)) return false
  const outcomeRecord = outcome as Record<string, unknown>
  if (outcomeRecord['ok'] === true) return Object.hasOwn(outcome, 'value')
  if (outcomeRecord['ok'] === false) {
    const error = outcomeRecord['error']
    return typeof error === 'object' && error !== null
      && typeof (error as Record<string, unknown>)['code'] === 'string'
      && typeof (error as Record<string, unknown>)['message'] === 'string'
  }
  return false
}

/** Identify the only expected read race and preserve all other filesystem errors. */
function isMissing(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === 'ENOENT'
}
