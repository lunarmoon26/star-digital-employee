/**
 * JSON vocabulary shared by the Star supervisor bridge and its Unix-socket
 * peers. Types here mirror the pinned DeepSeek Harness `0.1.1-rc.2` surface
 * that the plugin drives at runtime; the plugin itself imports no DSH packages
 * so the compiled module stays dependency-free.
 */

/** The only wire revision accepted by the local bridge. */
export type BridgeProtocolVersion = 1

/** A DSH session created through the Star bridge. */
export interface BridgeSession {
  /** Durable DSH session identity (shared by the agent and its session log). */
  sessionId: string
  /** Absolute project directory recorded by DSH. */
  cwd: string
  /** Creation time in Unix milliseconds. */
  createdAt: number
  /** The exact Star preset id this session was composed from. */
  presetId: string
  /** Current live activity when the host still has the Agent attached. */
  activity: 'idle' | 'running' | 'inactive'
}

/** A committed plain-text transcript item safe for the supervisor. */
export interface BridgeMessage {
  /** Durable role represented by the message. */
  role: 'user' | 'assistant'
  /** Joined text blocks; images, reasoning, and tool details remain in DSH. */
  text: string
}

/** Why a bridged prompt finished. */
export type BridgeStopReason = 'end_turn' | 'cancelled'

/** One successful prompt relay result. */
export interface BridgePromptResult {
  /** Completion outcome observed from the durable turn boundary. */
  stopReason: BridgeStopReason
  /** Assistant messages committed by the operation. */
  messages: readonly BridgeMessage[]
  /** Durable turn number claimed for this prompt, when the agent started it. */
  turn?: number
}

/** Bounded, JSON-safe projection of session events since a watermark. */
export type BridgeObservedEvent =
  | { seq: number; type: 'turn/start'; turn: number }
  | { seq: number; type: 'turn/end'; turn: number; reason: string }
  | { seq: number; type: 'message'; role: 'user' | 'assistant'; turn: number; step: number; text: string; interrupted?: boolean }
  | { seq: number; type: 'tool/call'; turn: number; step: number; name: string; arguments: string }
  | { seq: number; type: 'tool/result'; turn: number; step: number; error?: string }

/** One bounded observation window. */
export interface BridgeObserveResult {
  /** Projected events with seq strictly greater than the requested watermark. */
  events: readonly BridgeObservedEvent[]
  /** Watermark to submit as `fromSeq` on the next observe call. */
  nextSeq: number
}

/** Local request operation names. */
export type BridgeMethod =
  | 'session/create'
  | 'session/list'
  | 'session/status'
  | 'session/observe'
  | 'session/history'
  | 'session/prompt'
  | 'session/cancel'
  | 'session/resume'
  | 'session/dispose'

/** Mutating operations that must carry a stable operation id. */
export type MutatingBridgeMethod = Extract<BridgeMethod,
  | 'session/create'
  | 'session/prompt'
  | 'session/cancel'
  | 'session/resume'
  | 'session/dispose'
>

/** Authenticated newline-delimited request sent from the supervisor. */
export interface BridgeRequest {
  /** Protocol revision. */
  version: BridgeProtocolVersion
  /** Caller-minted correlation id, echoed in the response. */
  id: string
  /** Stable caller-owned idempotency key; required for mutating operations. */
  operationId?: string
  /** Local capability read from the owner-only token file. */
  token: string
  /** Requested narrow operation. */
  method: BridgeMethod
  /** JSON operation payload. */
  params: unknown
}

/** Successful local bridge response. */
export interface BridgeSuccess {
  id: string
  ok: true
  value: unknown
}

/** Rejected local bridge response. */
export interface BridgeFailure {
  id: string
  ok: false
  error: {
    code: BridgeErrorCode
    message: string
  }
}

/** Stable bridge failure codes shared with the supervisor. */
export type BridgeErrorCode =
  | 'invalid-request'
  | 'unauthorized'
  | 'not-found'
  | 'conflict'
  | 'internal'

/** One local bridge response. */
export type BridgeResponse = BridgeSuccess | BridgeFailure

/** Operation outcome recorded for idempotent replay, without the request correlation id. */
export type OperationOutcome =
  | { ok: true; value: unknown }
  | { ok: false; error: { code: BridgeErrorCode; message: string } }

/** One recorded, completed mutating operation. */
export interface OperationRecord {
  /** Stable idempotency key supplied by the caller. */
  operationId: string
  /** Operation the outcome belongs to. */
  method: BridgeMethod
  /** Terminal outcome returned to the original caller. */
  outcome: OperationOutcome
}

/** Persisted bridge-owned session index. */
export interface BridgeRegistryEntry {
  sessionId: string
  cwd: string
  createdAt: number
  presetId: string
}

/** Persisted bridge-owned session index. */
export interface BridgeRegistry {
  version: BridgeProtocolVersion
  sessions: readonly BridgeRegistryEntry[]
}
