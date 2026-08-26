/**
 * Durable ownership index for bridge-owned sessions. Only sessions recorded
 * here may be controlled or resumed; the supervisor cannot reach a session the
 * bridge did not create.
 */

import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  BRIDGE_PROTOCOL_VERSION,
  type BridgeRegistry,
  type BridgeRegistryEntry,
} from './protocol.js'

/** Default empty ownership index. */
export function emptyRegistry(): BridgeRegistry {
  return { version: BRIDGE_PROTOCOL_VERSION, sessions: [] }
}

/**
 * Read the ownership index, tolerating a missing file as empty.
 * @param path - Absolute registry file path.
 */
export async function readRegistry(path: string): Promise<BridgeRegistry> {
  let source: string
  try {
    source = await readFile(path, 'utf8')
  } catch (error) {
    if (isMissing(error)) return emptyRegistry()
    throw error
  }
  const value = JSON.parse(source) as unknown
  if (!isRegistry(value)) throw new Error(`star-bridge: registry file ${JSON.stringify(path)} is invalid`)
  return value
}

/**
 * Atomically persist the ownership index as an owner-only regular file.
 * @param path - Absolute registry file path.
 * @param registry - Complete index to persist.
 */
export async function writeRegistry(path: string, registry: BridgeRegistry): Promise<void> {
  const temporary = `${path}.star-${process.pid}`
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(temporary, `${JSON.stringify(registry)}\n`, { mode: 0o600, flag: 'w' })
  await chmod(temporary, 0o600)
  await rename(temporary, path)
  await chmod(path, 0o600)
}

/** Whether a value is a well-formed ownership index. */
function isRegistry(value: unknown): value is BridgeRegistry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (record['version'] !== BRIDGE_PROTOCOL_VERSION || !Array.isArray(record['sessions'])) return false
  return record['sessions'].every(isRegistryEntry)
}

/** Whether a value is a well-formed ownership row. */
function isRegistryEntry(value: unknown): value is BridgeRegistryEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record['sessionId'] === 'string'
    && record['sessionId'] !== ''
    && typeof record['cwd'] === 'string'
    && record['cwd'] !== ''
    && typeof record['createdAt'] === 'number'
    && Number.isSafeInteger(record['createdAt'])
    && typeof record['presetId'] === 'string'
    && record['presetId'] !== ''
}

/** Identify the only expected read race and preserve all other filesystem errors. */
function isMissing(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === 'ENOENT'
}

/** Remove an orphaned temporary file left by a crashed write. */
export async function discardTemporary(path: string): Promise<void> {
  try {
    await rm(path, { force: true })
  } catch {
    // A concurrent write owns the path; nothing to repair.
  }
}
