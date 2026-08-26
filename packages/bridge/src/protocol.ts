/**
 * Transport helpers for the Star supervisor bridge protocol: newline-delimited
 * JSON framing, request parsing, response validation, and the operation-id
 * contract helpers shared by the plugin and its peers.
 */

import { randomUUID } from 'node:crypto'
import { createConnection, type Socket } from 'node:net'
import { StringDecoder } from 'node:string_decoder'
import {
  type BridgeErrorCode,
  type BridgeFailure,
  type BridgeMethod,
  type BridgeProtocolVersion,
  type BridgeRequest,
  type BridgeResponse,
} from './types.js'

export type {
  BridgeErrorCode,
  BridgeMessage,
  BridgeMethod,
  BridgeObserveResult,
  BridgeObservedEvent,
  BridgePromptResult,
  BridgeProtocolVersion,
  BridgeRegistry,
  BridgeRegistryEntry,
  BridgeRequest,
  BridgeResponse,
  BridgeSession,
  BridgeStopReason,
  MutatingBridgeMethod,
  OperationOutcome,
  OperationRecord,
} from './types.js'

/** The only wire revision accepted by the local bridge. */
export const BRIDGE_PROTOCOL_VERSION: BridgeProtocolVersion = 1

/** Upper bound for a correlation or operation id accepted on the wire. */
export const MAX_ID_BYTES = 128

/** Operations that mutate bridge-owned state and therefore require an operation id. */
export const MUTATING_METHODS: readonly BridgeMethod[] = [
  'session/create',
  'session/prompt',
  'session/cancel',
  'session/resume',
  'session/dispose',
]

/** Every operation the bridge dispatches. */
export const BRIDGE_METHODS: readonly BridgeMethod[] = [
  'session/create',
  'session/list',
  'session/status',
  'session/observe',
  'session/history',
  'session/prompt',
  'session/cancel',
  'session/resume',
  'session/dispose',
]

/** Whether an unknown value has JSON-object form. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether a method mutates bridge-owned state. */
export function isMutatingMethod(method: BridgeMethod): boolean {
  return (MUTATING_METHODS as readonly string[]).includes(method)
}

/**
 * Validate an operation id against the wire contract without trusting callers.
 * @returns the trimmed id, or `undefined` when it is unusable.
 */
export function validOperationId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed === '' || Buffer.byteLength(trimmed) > MAX_ID_BYTES) return undefined
  return trimmed
}

/**
 * Parse one client request without treating malformed input as a host exception.
 * @param value - Decoded untrusted request frame.
 * @returns the narrowed request, or `undefined` when its envelope is invalid.
 */
export function parseBridgeRequest(value: unknown): BridgeRequest | undefined {
  if (!isRecord(value)
    || value['version'] !== BRIDGE_PROTOCOL_VERSION
    || typeof value['id'] !== 'string'
    || value['id'] === ''
    || Buffer.byteLength(value['id']) > MAX_ID_BYTES
    || typeof value['token'] !== 'string'
    || value['token'] === '') return undefined
  const method = value['method']
  if (!(BRIDGE_METHODS as readonly unknown[]).includes(method)) return undefined
  const request: BridgeRequest = {
    version: BRIDGE_PROTOCOL_VERSION,
    id: value['id'],
    token: value['token'],
    method: method as BridgeMethod,
    params: value['params'],
  }
  if (value['operationId'] !== undefined) {
    const operationId = validOperationId(value['operationId'])
    if (operationId === undefined) return undefined
    request.operationId = operationId
  }
  return request
}

/** Encode one newline-delimited response frame. */
export function responseFrame(response: BridgeResponse): string {
  return `${JSON.stringify(response)}\n`
}

/** Encode one newline-delimited request frame. */
export function requestFrame(request: BridgeRequest): string {
  return `${JSON.stringify(request)}\n`
}

/** Emit one correctly shaped local failure. */
export function failure(
  id: string,
  code: BridgeErrorCode,
  message: string,
): Extract<BridgeResponse, { ok: false }> {
  return { id, ok: false, error: { code, message } }
}

/** Client connection facts supplied by a supervisor-side peer. */
export interface BridgeClientOptions {
  /** Path of the private Unix-domain socket owned by DSH. */
  socketPath: string
  /** Capability read from the DSH-owned token file. */
  token: string
  /** Bound used before the peer accepts a server reply. */
  maxResponseBytes: number
}

/** One bridge response translated into a thrown peer error. */
export class BridgeClientError extends Error {
  /** Stable host error code. */
  readonly code: BridgeFailure['error']['code']

  constructor(error: BridgeFailure['error']) {
    super(error.message)
    this.name = 'BridgeClientError'
    this.code = error.code
  }
}

/**
 * Call one host operation through a fresh local socket.
 * @param options - Authenticated client connection facts and response limit.
 * @param method - Exact bridge operation to invoke.
 * @param params - JSON payload for the selected operation.
 * @param operationId - Optional stable idempotency key for mutating operations.
 * @returns the successful host value, narrowed by the caller's expected type.
 */
export async function callBridge<T>(
  options: BridgeClientOptions,
  method: BridgeMethod,
  params: unknown,
  operationId?: string,
): Promise<T> {
  const request: BridgeRequest = {
    version: BRIDGE_PROTOCOL_VERSION,
    id: randomUUID(),
    token: options.token,
    method,
    params,
  }
  if (operationId !== undefined) request.operationId = operationId
  const socket = createConnection(options.socketPath)
  try {
    await connected(socket)
    await write(socket, requestFrame(request))
    const response = await readResponse(socket, options.maxResponseBytes, request.id)
    if (!response.ok) throw new BridgeClientError(response.error)
    return response.value as T
  } finally {
    socket.destroy()
  }
}

/** Wait for a socket connection or its terminal error. */
function connected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const onConnect = (): void => {
      cleanup()
      resolve()
    }
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    const cleanup = (): void => {
      socket.off('connect', onConnect)
      socket.off('error', onError)
    }
    socket.once('connect', onConnect)
    socket.once('error', onError)
  })
}

/** Write a complete local protocol frame. */
function write(socket: Socket, frame: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(frame, error => {
      if (error === undefined || error === null) resolve()
      else reject(error)
    })
  })
}

/** Read exactly one newline-delimited response. */
function readResponse(socket: Socket, maxBytes: number, requestId: string): Promise<BridgeResponse> {
  return new Promise((resolve, reject) => {
    let bytes = 0
    let buffered = ''
    const decoder = new StringDecoder('utf8')
    const onData = (chunk: Buffer): void => {
      bytes += chunk.byteLength
      if (bytes > maxBytes) {
        cleanup()
        reject(new Error(`Star bridge response exceeds ${maxBytes} bytes`))
        return
      }
      buffered += decoder.write(chunk)
      const newline = buffered.indexOf('\n')
      if (newline < 0) return
      cleanup()
      try {
        const value = JSON.parse(buffered.slice(0, newline)) as unknown
        if (!isBridgeResponse(value) || value.id !== requestId) {
          throw new Error('Star bridge returned an invalid response')
        }
        resolve(value)
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    const onEnd = (): void => {
      cleanup()
      reject(new Error('Star bridge closed without responding'))
    }
    const onClose = (): void => {
      cleanup()
      reject(new Error('Star bridge closed without responding'))
    }
    const cleanup = (): void => {
      socket.off('data', onData)
      socket.off('error', onError)
      socket.off('end', onEnd)
      socket.off('close', onClose)
    }
    socket.on('data', onData)
    socket.once('error', onError)
    socket.once('end', onEnd)
    socket.once('close', onClose)
  })
}

/** Validate one untrusted server response before narrowing it for the peer. */
function isBridgeResponse(value: unknown): value is BridgeResponse {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['ok'] !== 'boolean') return false
  if (value['ok']) return Object.hasOwn(value, 'value')
  const error = value['error']
  return isRecord(error)
    && (error['code'] === 'invalid-request' || error['code'] === 'unauthorized'
      || error['code'] === 'not-found' || error['code'] === 'conflict' || error['code'] === 'internal')
    && typeof error['message'] === 'string'
}
