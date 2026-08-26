/**
 * Deployment-owned configuration for the Star supervisor bridge. The compiled
 * plugin exports no Schemastery schema (it must stay dependency-free), so it
 * validates configuration itself before opening any path.
 */

import { isAbsolute } from 'node:path'

/** Cordis configuration for the host half of the Star bridge. */
export interface Config {
  /** Absolute Unix-domain socket path owned by the DSH process. */
  socketPath: string
  /** Owner-only capability file shared with the supervisor. */
  tokenFile: string
  /** Durable index of DSH sessions created by this bridge. */
  registryFile: string
  /** Durable operation-id ledger recording completed mutating operations. */
  operationLogFile: string
  /** The exact Star preset id composed into every bridge-owned session. */
  presetId: string
  /** Maximum accepted newline-delimited request size. */
  maxRequestBytes: number
  /** Maximum emitted newline-delimited response size, including its JSON envelope. */
  maxResponseBytes: number
  /** Maximum bytes accepted in one prompt text. */
  maxTextBytes: number
  /** Maximum committed user/assistant messages returned by history. */
  maxHistoryMessages: number
  /** Maximum projected events returned by observe. */
  maxObservedEvents: number
  /** Maximum completed operations retained by the idempotency ledger. */
  maxOperationRecords: number
}

/** Fully checked host configuration. */
export type ResolvedConfig = Config

const PATH_FIELDS = ['socketPath', 'tokenFile', 'registryFile', 'operationLogFile'] as const
type PathField = (typeof PATH_FIELDS)[number]
const POSITIVE_INT_FIELDS = [
  'maxRequestBytes',
  'maxResponseBytes',
  'maxTextBytes',
  'maxHistoryMessages',
  'maxObservedEvents',
  'maxOperationRecords',
] as const
type PositiveIntField = (typeof POSITIVE_INT_FIELDS)[number]

/** Preset ids are the compiler-generated `star-<sha256>` form. */
const PRESET_ID_PATTERN = /^star-[0-9a-f]{64}$/

function assertAbsolutePath(name: PathField, value: unknown): asserts value is string {
  if (typeof value !== 'string' || !isAbsolute(value)) {
    throw new Error(`star-bridge: ${name} must be an absolute path`)
  }
}

function assertPositiveSafeInteger(name: PositiveIntField, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`star-bridge: ${name} must be a positive safe integer`)
  }
}

/**
 * Validate the configuration at plugin load, before the bridge opens any path.
 * @param config - Deployment-owned host paths and limits.
 * @returns the validated configuration.
 */
export function resolveConfig(config: Config): ResolvedConfig {
  if (!isRecordConfig(config)) throw new Error('star-bridge: configuration must be an object')
  for (const field of PATH_FIELDS) assertAbsolutePath(field, config[field])
  for (const field of POSITIVE_INT_FIELDS) assertPositiveSafeInteger(field, config[field])
  if (config.maxResponseBytes < 256) {
    throw new Error('star-bridge: maxResponseBytes must be at least 256')
  }
  if (typeof config.presetId !== 'string' || !PRESET_ID_PATTERN.test(config.presetId)) {
    throw new Error('star-bridge: presetId must be a compiler-generated star-<sha256> id')
  }
  return config
}

function isRecordConfig(value: unknown): value is Config {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
