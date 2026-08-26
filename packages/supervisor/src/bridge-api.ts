/**
 * The narrow supervisor-facing surface of the DSH supervisor bridge (ADR 0009).
 * The supervisor depends on this interface, not on the socket transport, so the
 * state machine is testable against a fake bridge and swappable in production.
 */

import {
  callBridge,
  type BridgeClientOptions,
  type BridgePromptResult,
} from '@star/employee-bridge'

export interface CreatedSession {
  sessionId: string
}

export interface BridgeApi {
  /** Create (or resume via the bridge operation-id ledger) a session and preset. */
  createSession(cwd: string, operationId: string): Promise<CreatedSession>
  /** Queue one prompt and await its owned turn. */
  prompt(sessionId: string, text: string, operationId: string): Promise<BridgePromptResult>
  /** Cold-resume one bridge-owned session. */
  resumeSession(sessionId: string, operationId: string): Promise<{ sessionId: string }>
}

export interface SocketBridgeClientOptions {
  socketPath: string
  token: string
  maxResponseBytes?: number
}

/** Socket implementation backed by `@star/employee-bridge`'s client protocol. */
export class SocketBridgeClient implements BridgeApi {
  readonly #options: BridgeClientOptions

  constructor(options: SocketBridgeClientOptions) {
    this.#options = {
      socketPath: options.socketPath,
      token: options.token,
      maxResponseBytes: options.maxResponseBytes ?? 1_048_576,
    }
  }

  async createSession(cwd: string, operationId: string): Promise<CreatedSession> {
    return await callBridge<CreatedSession>(this.#options, 'session/create', { cwd }, operationId)
  }

  async prompt(sessionId: string, text: string, operationId: string): Promise<BridgePromptResult> {
    return await callBridge<BridgePromptResult>(
      this.#options,
      'session/prompt',
      { sessionId, text },
      operationId,
    )
  }

  async resumeSession(sessionId: string, operationId: string): Promise<{ sessionId: string }> {
    return await callBridge<{ sessionId: string }>(
      this.#options,
      'session/resume',
      { sessionId },
      operationId,
    )
  }
}
