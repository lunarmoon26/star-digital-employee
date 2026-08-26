/**
 * Star supervisor bridge: a self-contained DSH host plugin that opens an
 * owner-only Unix-domain socket and drives bridge-owned sessions through the
 * pinned DeepSeek Harness services. It imports no DSH packages at runtime so the
 * compiled module ships as one dependency-free file under the immutable tree.
 *
 * The structural types below mirror the pinned `@deepseek-ai/dsh-*` 0.1.1-rc.2
 * host surface the plugin talks to at runtime (see the architecture decision
 * records for the authoritative upstream sources).
 */

import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Stats } from 'node:fs'
import { chmod, lstat, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { createConnection, createServer, type Server, type Socket } from 'node:net'
import { dirname, isAbsolute } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { resolveConfig, type Config, type ResolvedConfig } from './config.js'
import { appendLedgerRecord, readLedger } from './ledger.js'
import {
  BRIDGE_PROTOCOL_VERSION,
  failure,
  isMutatingMethod,
  isRecord,
  parseBridgeRequest,
  responseFrame,
  type BridgeErrorCode,
  type BridgeMethod,
  type BridgeObservedEvent,
  type BridgePromptResult,
  type BridgeRegistry,
  type BridgeRequest,
  type BridgeResponse,
  type BridgeSession,
  type OperationRecord,
} from './protocol.js'
import { emptyRegistry, readRegistry, writeRegistry } from './registry.js'

export { BRIDGE_PROTOCOL_VERSION } from './protocol.js'
export type { Config as StarBridgeConfig } from './config.js'
export type {
  BridgeMessage,
  BridgeMethod,
  BridgeObserveResult,
  BridgeObservedEvent,
  BridgePromptResult,
  BridgeRegistry,
  BridgeRequest,
  BridgeResponse,
  BridgeSession,
  BridgeStopReason,
  OperationRecord,
} from './protocol.js'

/** Cordis plugin identity. */
export const name = 'star-supervisor-bridge'

/**
 * Host-plane services the bridge requires: the agent registry, the preset
 * roster, the durable session store, and the default model selection.
 */
export const inject = ['agentDefaultModel', 'agentPresets', 'agents', 'sessionPersistence']

// ── Structural mirrors of the pinned DSH host surface (runtime-only) ────────

interface AgentOptions {
  provider?: string
  model?: string
  maxTokens?: number
}

interface AgentSetup {
  (agentCtx: unknown): void | Promise<void>
}

interface CreateAgentOptions {
  sessionId: string
  meta?: { cwd?: string; agentPreset?: string }
  agentOptions?: AgentOptions
  setup?: AgentSetup
}

interface ResumeAgentOptions {
  resumeSessionId: string
  agentOptions?: AgentOptions
  setup?: AgentSetup
}

interface AgentHandle {
  agent: Agent
  dispose(): Promise<void>
}

interface AgentRegistry {
  create(options: CreateAgentOptions): Promise<AgentHandle>
  resume(options: ResumeAgentOptions): Promise<AgentHandle>
  get(id: string): Agent | undefined
}

interface AgentPresets {
  mount(agentCtx: unknown, presetId: string): Promise<unknown>
}

interface SessionInspection {
  meta: { id?: string; agentPreset?: string }
  events: readonly SessionEvent[]
}

interface SessionPersistence {
  inspect(id: string): Promise<SessionInspection>
}

interface ModelSelection {
  provider?: string
  model?: string
}

interface AgentDefaultModel {
  currentSelection(): ModelSelection
}

interface SessionEvent {
  seq: number
  type: string
  data: Record<string, unknown>
}

interface Session {
  id: string
  events: readonly SessionEvent[]
}

interface Agent {
  id: string
  session: Session
  status: 'idle' | 'running'
  followup(message: unknown): void
  cancel(cause: { kind: 'user' }): void
}

interface BridgeContext {
  agentDefaultModel: AgentDefaultModel
  agentPresets: AgentPresets
  agents: AgentRegistry
  sessionPersistence: SessionPersistence
  logger: { warn(message: string): void }
  on(event: string, listener: (...args: any[]) => void): () => void
}

// ── Bridge implementation ────────────────────────────────────────────────────

/** A narrow domain error that maps to a stable bridge failure response. */
class BridgeError extends Error {
  constructor(
    readonly code: Extract<BridgeResponse, { ok: false }>['error']['code'],
    message: string,
  ) {
    super(message)
    this.name = 'BridgeError'
  }
}

/** One bridge prompt awaiting its own inbox claim and durable turn. */
interface PromptClaim {
  readonly agent: Agent
  cancelled: boolean
  turn: number | undefined
  resolveTurn: (turn: number | undefined) => void
  resolveEnd: (reason: string | undefined) => void
}

/** Running bridge state, kept local to the owning Cordis effect. */
class StarBridge {
  private registry: BridgeRegistry = emptyRegistry()
  private ledger: OperationRecord[] = []
  private token = ''
  private server: Server | undefined
  private ownsSocket = false
  private readonly handles = new Map<string, AgentHandle>()
  private readonly resumes = new Map<string, Promise<AgentHandle>>()
  private creationTail = Promise.resolve()
  private readonly connections = new Set<Socket>()
  private readonly promptTails = new Map<string, Promise<void>>()
  private readonly promptClaims = new Map<string, PromptClaim>()
  private stopClaimListeners: (() => void) | undefined

  constructor(private readonly ctx: BridgeContext, private readonly config: ResolvedConfig) {}

  /** Open private files and start accepting local requests. */
  async start(): Promise<void> {
    this.token = await ensureToken(this.config.tokenFile)
    this.registry = await readRegistry(this.config.registryFile)
    this.ledger = await readLedger(this.config.operationLogFile, this.config.maxOperationRecords)
    await clearStaleSocket(this.config.socketPath)
    const stopClaimed = this.ctx.on('agent/inbox/claimed', ({ agent, message, turn }: {
      agent: Agent
      message: { id: string }
      turn: number
    }) => {
      const claim = this.promptClaims.get(message.id)
      if (claim?.agent === agent) {
        claim.turn = turn
        claim.resolveTurn(turn)
      }
    })
    const stopDiscarded = this.ctx.on('agent/inbox/discarded', ({ agent, message }: {
      agent: Agent
      message: { id: string }
    }) => {
      const claim = this.promptClaims.get(message.id)
      if (claim?.agent === agent) {
        claim.cancelled = true
        claim.resolveTurn(undefined)
        claim.resolveEnd(undefined)
      }
    })
    const stopTurnEnd = this.ctx.on('session/event', (session: Session, event: SessionEvent) => {
      if (event.type !== 'turn/end') return
      const reason = (event.data['reason'] as { kind?: string } | undefined)?.kind
      for (const claim of this.promptClaims.values()) {
        if (claim.agent.session === session && claim.turn === event.data['turn']) claim.resolveEnd(reason)
      }
    })
    const stopDisposed = this.ctx.on('agent/disposed', ({ agent }: { agent: Agent }) => {
      this.handles.delete(agent.id)
      for (const claim of this.promptClaims.values()) {
        if (claim.agent === agent) {
          claim.cancelled = true
          claim.resolveTurn(undefined)
          claim.resolveEnd(undefined)
        }
      }
    })
    this.stopClaimListeners = () => {
      stopClaimed()
      stopDiscarded()
      stopTurnEnd()
      stopDisposed()
    }
    this.server = createServer(socket => { this.accept(socket) })
    try {
      await listen(this.server, this.config.socketPath)
      this.ownsSocket = true
      await chmod(this.config.socketPath, 0o600)
    } catch (error: unknown) {
      await this.stop()
      throw error
    }
  }

  /** Stop accepting work and remove only the socket this active process created. */
  async stop(): Promise<void> {
    this.stopClaimListeners?.()
    this.stopClaimListeners = undefined
    for (const claim of this.promptClaims.values()) {
      claim.cancelled = true
      claim.resolveTurn(undefined)
      claim.resolveEnd(undefined)
    }
    const server = this.server
    this.server = undefined
    for (const socket of this.connections) socket.destroy()
    if (server?.listening) await close(server)
    const ownsSocket = this.ownsSocket
    this.ownsSocket = false
    if (!ownsSocket) return
    try {
      const entry = await lstat(this.config.socketPath)
      if (entry.isSocket()) await unlink(this.config.socketPath)
    } catch (error: unknown) {
      if (!isMissing(error)) throw error
    }
  }

  /** Serve newline-delimited requests from one local supervisor connection. */
  private accept(socket: Socket): void {
    this.connections.add(socket)
    socket.once('close', () => { this.connections.delete(socket) })
    let buffered = ''
    let bytes = 0
    let ended = false
    const decoder = new StringDecoder('utf8')
    socket.on('data', (chunk: Buffer) => {
      if (ended) return
      bytes += chunk.byteLength
      if (bytes > this.config.maxRequestBytes) {
        ended = true
        this.endResponse(socket, failure('', 'invalid-request', `request exceeds ${this.config.maxRequestBytes} bytes`))
        return
      }
      buffered += decoder.write(chunk)
      let newline = buffered.indexOf('\n')
      while (newline >= 0 && !ended) {
        const frame = buffered.slice(0, newline)
        buffered = buffered.slice(newline + 1)
        bytes = Buffer.byteLength(buffered)
        ended = true
        void this.respond(socket, frame)
        newline = buffered.indexOf('\n')
      }
    })
    socket.on('error', () => {
      // The peer owns its own connection lifetime; there is no bridge state to repair.
    })
  }

  /** Authenticate, deduplicate, dispatch, and serialize one request. */
  private async respond(socket: Socket, frame: string): Promise<void> {
    let request: BridgeRequest | undefined
    try {
      request = parseBridgeRequest(JSON.parse(frame) as unknown)
    } catch {
      this.endResponse(socket, failure('', 'invalid-request', 'request is not valid JSON'))
      return
    }
    if (request === undefined) {
      this.endResponse(socket, failure('', 'invalid-request', 'request has an unsupported shape'))
      return
    }
    if (!sameToken(request.token, this.token)) {
      this.endResponse(socket, failure(request.id, 'unauthorized', 'bridge capability was rejected'))
      return
    }

    const method = request.method
    if (isMutatingMethod(method)) {
      if (request.operationId === undefined) {
        this.endResponse(socket, failure(request.id, 'invalid-request', `${method} requires an operationId`))
        return
      }
      const recorded = this.ledger.find(entry => entry.operationId === request.operationId)
      if (recorded !== undefined) {
        if (recorded.method !== method) {
          this.endResponse(socket, failure(request.id, 'conflict', 'operationId was already used for a different operation'))
          return
        }
        this.endResponse(socket, wrapOutcome(request.id, recorded.outcome))
        return
      }
    }

    try {
      const value = await this.dispatch(method, request.params)
      const response: BridgeResponse = { id: request.id, ok: true, value }
      if (request.operationId !== undefined && isMutatingMethod(method)) {
        this.ledger = await this.recordOutcome(request.operationId, method, { ok: true, value })
      }
      this.endResponse(socket, response)
    } catch (error: unknown) {
      if (error instanceof BridgeError) {
        if (request.operationId !== undefined && isMutatingMethod(method) && isRecordable(error.code)) {
          this.ledger = await this.recordOutcome(request.operationId, method, {
            ok: false,
            error: { code: error.code, message: error.message },
          })
        }
        this.endResponse(socket, failure(request.id, error.code, error.message))
      } else {
        this.ctx.logger.warn(`star-supervisor-bridge: ${String(error)}`)
        this.endResponse(socket, failure(request.id, 'internal', 'bridge operation failed'))
      }
    }
  }

  private async recordOutcome(
    operationId: string,
    method: BridgeMethod,
    outcome: OperationRecord['outcome'],
  ): Promise<OperationRecord[]> {
    return await appendLedgerRecord(
      this.config.operationLogFile,
      { operationId, method, outcome },
      this.config.maxOperationRecords,
    )
  }

  /** End one client connection with an envelope that fits the configured response limit. */
  private endResponse(socket: Socket, response: BridgeResponse): void {
    const frame = responseFrame(response)
    if (Buffer.byteLength(frame) <= this.config.maxResponseBytes) {
      socket.end(frame)
      return
    }
    socket.end(responseFrame(failure(response.id, 'internal', 'bridge response exceeds configured maximum')))
  }

  /** Reject creation before persistence when its result cannot fit any valid request id. */
  private assertCreateResponseFits(session: BridgeSession): void {
    const response: BridgeResponse = { id: 'x'.repeat(128), ok: true, value: session }
    if (Buffer.byteLength(responseFrame(response)) > this.config.maxResponseBytes) {
      throw new BridgeError('invalid-request', 'session/create response exceeds configured maximum')
    }
  }

  /** Execute one exact operation. Every mutating target must be bridge-owned. */
  private async dispatch(method: BridgeMethod, params: unknown): Promise<unknown> {
    switch (method) {
      case 'session/create':
        return await this.create(params)
      case 'session/list':
        assertEmptyParams(params)
        return this.list()
      case 'session/status':
        return this.status(requiredSessionId(params))
      case 'session/observe':
        return await this.observe(params)
      case 'session/history':
        return await this.history(requiredSessionId(params))
      case 'session/prompt':
        return await this.prompt(params)
      case 'session/cancel':
        return this.cancel(requiredSessionId(params))
      case 'session/resume':
        return await this.resume(requiredSessionId(params))
      case 'session/dispose':
        return await this.dispose(requiredSessionId(params))
      default:
        method satisfies never
        throw new BridgeError('invalid-request', 'unsupported bridge operation')
    }
  }

  /** Create one normal Web session, composed from the configured Star preset. */
  private async create(params: unknown): Promise<BridgeSession> {
    const cwd = requiredAbsoluteCwd(params)
    const directory = await usableDirectory(cwd)
    if (!directory) throw new BridgeError('invalid-request', 'session/create cwd is not an accessible directory')
    return await this.serializeCreation(async () => {
      const sessionId = `star-${randomUUID()}`
      const createdAt = Date.now()
      const presetId = this.config.presetId
      const session: BridgeSession = { sessionId, cwd, createdAt, presetId, activity: 'idle' }
      this.assertCreateResponseFits(session)
      const handle = await this.ctx.agents.create({
        sessionId,
        meta: { cwd, agentPreset: presetId },
        agentOptions: this.ctx.agentDefaultModel.currentSelection(),
        setup: async agentCtx => { await this.ctx.agentPresets.mount(agentCtx, presetId) },
      })
      this.handles.set(sessionId, handle)
      const nextRegistry: BridgeRegistry = {
        version: BRIDGE_PROTOCOL_VERSION,
        sessions: [...this.registry.sessions, { sessionId, cwd, createdAt, presetId }],
      }
      try {
        await writeRegistry(this.config.registryFile, nextRegistry)
        this.registry = nextRegistry
      } catch (error: unknown) {
        await handle.dispose()
        this.handles.delete(sessionId)
        throw error
      }
      return session
    })
  }

  /** Return every bridge-owned session with live activity projected at read time. */
  private list(): readonly BridgeSession[] {
    return this.registry.sessions.map(session => this.sessionView(session))
  }

  /** Return status only for a session this bridge created. */
  private status(sessionId: string): BridgeSession {
    return this.sessionView(this.recordFor(sessionId))
  }

  /** Return a bounded event projection since a watermark for one bridge-owned session. */
  private async observe(params: unknown): Promise<{ events: readonly BridgeObservedEvent[]; nextSeq: number }> {
    const { sessionId, fromSeq } = requiredSessionIdAndWatermark(params)
    this.recordFor(sessionId)
    const events = await this.eventsFor(sessionId)
    const from = fromSeq ?? 0
    const projected: BridgeObservedEvent[] = []
    let currentTurn: number | undefined
    let currentStep: number | undefined
    for (const event of events) {
      if (event.type === 'turn/start') {
        currentTurn = event.data['turn'] as number
        currentStep = undefined
      } else if (event.type === 'step/start') {
        currentTurn = event.data['turn'] as number
        currentStep = event.data['step'] as number
      }
      if (event.seq <= from) continue
      const observed = projectEvent(event, currentTurn, currentStep)
      if (observed === undefined) continue
      projected.push(observed)
      if (projected.length >= this.config.maxObservedEvents) break
    }
    const nextSeq = projected.length > 0 ? projected[projected.length - 1]!.seq : from
    return { events: projected, nextSeq }
  }

  /** Return only committed plain text, bounded by the deployment's history policy. */
  private async history(sessionId: string): Promise<{ messages: readonly { role: 'user' | 'assistant'; text: string }[] }> {
    this.recordFor(sessionId)
    const events = await this.eventsFor(sessionId)
    return { messages: messagesFrom(events).slice(-this.config.maxHistoryMessages) }
  }

  /** Deliver one text prompt and return messages committed during its owned interval. */
  private async prompt(params: unknown): Promise<BridgePromptResult> {
    if (!isRecord(params) || typeof params['sessionId'] !== 'string' || typeof params['text'] !== 'string') {
      throw new BridgeError('invalid-request', 'session/prompt requires sessionId and text')
    }
    const { sessionId, text } = params
    if (Buffer.byteLength(sessionId) > 128) throw new BridgeError('invalid-request', 'session/prompt sessionId is unsupported')
    this.recordFor(sessionId)
    if (text.length === 0) throw new BridgeError('invalid-request', 'session/prompt text must not be empty')
    if (Buffer.byteLength(text) > this.config.maxTextBytes) {
      throw new BridgeError('invalid-request', `session/prompt text exceeds ${this.config.maxTextBytes} bytes`)
    }
    return await this.serializePrompt(sessionId, async () => {
      const agent = await this.agentFor(sessionId)
      const message = {
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text }],
        source: { kind: 'user' },
      }
      const claimed = deferred<number | undefined>()
      const completed = deferred<string | undefined>()
      const claim: PromptClaim = {
        agent,
        cancelled: false,
        turn: undefined,
        resolveTurn: claimed.resolve,
        resolveEnd: completed.resolve,
      }
      this.promptClaims.set(message.id, claim)
      try {
        agent.followup(message)
        const turn = await claimed.promise
        if (turn === undefined || claim.cancelled) return { stopReason: 'cancelled', messages: [] }
        const end = await completed.promise
        if (end === undefined || claim.cancelled) return { stopReason: 'cancelled', messages: [] }
        if (end === 'error') throw new BridgeError('internal', 'session prompt failed')
        const messages = messagesFrom(agent.session.events.filter(event =>
          event.type === 'assistant/message' && event.data['turn'] === turn))
        return { stopReason: end === 'interrupted' ? 'cancelled' : 'end_turn', messages, turn }
      } finally {
        this.promptClaims.delete(message.id)
      }
    })
  }

  /** Cancel the active DSH Agent without waking a cold session merely to stop it. */
  private cancel(sessionId: string): { accepted: boolean } {
    this.recordFor(sessionId)
    const agent = this.ctx.agents.get(sessionId)
    if (agent === undefined) return { accepted: false }
    for (const claim of this.promptClaims.values()) {
      if (claim.agent === agent) {
        claim.cancelled = true
        claim.resolveTurn(undefined)
        claim.resolveEnd(undefined)
      }
    }
    agent.cancel({ kind: 'user' })
    return { accepted: true }
  }

  /** Cold-resume one bridge-owned persisted session, reusing a live agent when present. */
  private async resume(sessionId: string): Promise<{ sessionId: string; activity: 'idle' | 'running' | 'inactive' }> {
    const handle = await this.resumeHandle(sessionId)
    return { sessionId, activity: handle.agent.status }
  }

  /** Reuse a live Agent or resume exactly one bridge-owned persisted session. */
  private async resumeHandle(sessionId: string): Promise<AgentHandle> {
    const record = this.recordFor(sessionId)
    const live = this.ctx.agents.get(sessionId)
    if (live !== undefined) {
      const existing = this.handles.get(sessionId)
      if (existing !== undefined) return existing
      // A live agent without a tracked handle cannot be torn down by this bridge;
      // reconstruct a tracking entry is impossible, so surface it through the live agent.
      throw new BridgeError('conflict', 'session is live but not owned by this bridge process')
    }
    const tracked = this.handles.get(sessionId)
    if (tracked !== undefined) return tracked
    const pending = this.resumes.get(sessionId)
    if (pending !== undefined) return await pending
    const resume = (async () => {
      const presetId = record.presetId
      return await this.ctx.agents.resume({
        resumeSessionId: sessionId,
        agentOptions: this.ctx.agentDefaultModel.currentSelection(),
        setup: async agentCtx => { await this.ctx.agentPresets.mount(agentCtx, presetId) },
      })
    })().finally(() => { this.resumes.delete(sessionId) })
    this.resumes.set(sessionId, resume)
    const handle = await resume
    this.handles.set(sessionId, handle)
    return handle
  }

  /** Tear down a live bridge-owned agent while retaining its persisted session for later resume. */
  private async dispose(sessionId: string): Promise<{ accepted: boolean }> {
    this.recordFor(sessionId)
    const handle = this.handles.get(sessionId)
    if (handle === undefined) {
      const agent = this.ctx.agents.get(sessionId)
      if (agent === undefined) return { accepted: false }
      agent.cancel({ kind: 'user' })
      return { accepted: true }
    }
    this.handles.delete(sessionId)
    await handle.dispose()
    return { accepted: true }
  }

  /** Reuse a live Agent or resume exactly one bridge-owned persisted session. */
  private async agentFor(sessionId: string): Promise<Agent> {
    const live = this.ctx.agents.get(sessionId)
    if (live !== undefined) return live
    return (await this.resumeHandle(sessionId)).agent
  }

  /** Read events for a live or cold bridge-owned session, bounded to the newest window. */
  private async eventsFor(sessionId: string): Promise<readonly SessionEvent[]> {
    const live = this.ctx.agents.get(sessionId)
    if (live !== undefined) return live.session.events
    const inspection = await this.ctx.sessionPersistence.inspect(sessionId)
    return inspection.events
  }

  /** Turn one persisted ownership row into a live activity view. */
  private sessionView(record: BridgeRegistry['sessions'][number]): BridgeSession {
    const agent = this.ctx.agents.get(record.sessionId)
    return {
      ...record,
      activity: agent === undefined ? 'inactive' : agent.status,
    }
  }

  /** Refuse arbitrary DSH session ids before any control or transcript operation. */
  private recordFor(sessionId: string): BridgeRegistry['sessions'][number] {
    const record = this.registry.sessions.find(candidate => candidate.sessionId === sessionId)
    if (record === undefined) throw new BridgeError('not-found', 'session is not managed by the Star bridge')
    return record
  }

  /** Serialize output windows so concurrent prompts cannot claim one another's messages. */
  private async serializePrompt<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.promptTails.get(sessionId) ?? Promise.resolve()
    const current = previous.then(operation)
    const tail = current.then(() => undefined, () => undefined)
    this.promptTails.set(sessionId, tail)
    try {
      return await current
    } finally {
      if (this.promptTails.get(sessionId) === tail) this.promptTails.delete(sessionId)
    }
  }

  /** Serialize session publication so every committed registry generation keeps all earlier rows. */
  private async serializeCreation<T>(operation: () => Promise<T>): Promise<T> {
    const current = this.creationTail.then(operation)
    const tail = current.then(() => undefined, () => undefined)
    this.creationTail = tail
    return await current
  }
}

/**
 * Mount the host bridge and tie its socket lifetime to the Cordis plugin fiber.
 * @param ctx - Web-host Cordis context providing persisted DSH sessions.
 * @param config - Deployment-owned bridge paths, preset id, and limits.
 * @returns A disposer that stops the host and removes its socket.
 */
export async function apply(ctx: BridgeContext, config: Config): Promise<() => Promise<void>> {
  const bridge = new StarBridge(ctx, resolveConfig(config))
  await bridge.start()
  return async () => { await bridge.stop() }
}

// ── Request validation helpers ──────────────────────────────────────────────

/** Reject non-empty parameter records where the operation accepts no input. */
function assertEmptyParams(params: unknown): void {
  if (!isRecord(params) || Object.keys(params).length !== 0) {
    throw new BridgeError('invalid-request', 'operation does not accept parameters')
  }
}

/** Extract a session target from an untrusted bridge request. */
function requiredSessionId(params: unknown): string {
  if (!isRecord(params)
    || typeof params['sessionId'] !== 'string'
    || params['sessionId'] === ''
    || Buffer.byteLength(params['sessionId']) > 128) {
    throw new BridgeError('invalid-request', 'operation requires a sessionId')
  }
  return params['sessionId']
}

/** Extract a session target and optional event watermark. */
function requiredSessionIdAndWatermark(params: unknown): { sessionId: string; fromSeq?: number } {
  if (!isRecord(params) || typeof params['sessionId'] !== 'string' || params['sessionId'] === ''
    || Buffer.byteLength(params['sessionId']) > 128) {
    throw new BridgeError('invalid-request', 'session/observe requires a sessionId')
  }
  const fromSeq = params['fromSeq']
  if (fromSeq !== undefined && (typeof fromSeq !== 'number' || !Number.isSafeInteger(fromSeq) || fromSeq < 0)) {
    throw new BridgeError('invalid-request', 'session/observe fromSeq must be a non-negative safe integer')
  }
  const result: { sessionId: string; fromSeq?: number } = { sessionId: params['sessionId'] }
  if (fromSeq !== undefined) result.fromSeq = fromSeq
  return result
}

/** Extract and validate the absolute working directory for a create request. */
function requiredAbsoluteCwd(params: unknown): string {
  if (!isRecord(params) || typeof params['cwd'] !== 'string') {
    throw new BridgeError('invalid-request', 'session/create requires an absolute cwd')
  }
  const cwd = params['cwd']
  if (!isAbsolute(cwd)) throw new BridgeError('invalid-request', 'session/create cwd must be absolute')
  return cwd
}

// ── Projection helpers ──────────────────────────────────────────────────────

/** Project one raw event into a bounded, JSON-safe supervisor fact. */
function projectEvent(
  event: SessionEvent,
  turn: number | undefined,
  step: number | undefined,
): BridgeObservedEvent | undefined {
  switch (event.type) {
    case 'turn/start':
      return { seq: event.seq, type: 'turn/start', turn: event.data['turn'] as number }
    case 'turn/end':
      return {
        seq: event.seq,
        type: 'turn/end',
        turn: event.data['turn'] as number,
        reason: String((event.data['reason'] as { kind?: unknown } | undefined)?.kind ?? 'completed'),
      }
    case 'user/message': {
      const message = event.data as { source?: { kind?: unknown }; content?: readonly { type?: string; text?: string }[] }
      if (message.source?.kind !== 'user') return undefined
      const text = textOf(message.content)
      if (text === '') return undefined
      return { seq: event.seq, type: 'message', role: 'user', turn: turn ?? 0, step: step ?? 0, text }
    }
    case 'assistant/message': {
      const message = event.data['message'] as { content?: readonly { type?: string; text?: string }[] }
      const text = textOf(message?.content)
      return {
        seq: event.seq,
        type: 'message',
        role: 'assistant',
        turn: event.data['turn'] as number,
        step: event.data['step'] as number,
        text,
        ...(event.data['interrupted'] === true ? { interrupted: true } : {}),
      }
    }
    case 'tool/call':
      return {
        seq: event.seq,
        type: 'tool/call',
        turn: event.data['turn'] as number,
        step: event.data['step'] as number,
        name: String(event.data['name'] ?? ''),
        arguments: String(event.data['arguments'] ?? ''),
      }
    case 'tool/result': {
      const error = event.data['error'] as { code?: string } | undefined
      return {
        seq: event.seq,
        type: 'tool/result',
        turn: event.data['turn'] as number,
        step: event.data['step'] as number,
        ...(error?.code !== undefined ? { error: error.code } : {}),
      }
    }
    default:
      return undefined
  }
}

/** Join text blocks from a message content list. */
function textOf(content: readonly { type?: string; text?: string }[] | undefined): string {
  if (content === undefined) return ''
  return content.filter(block => block.type === 'text').map(block => block.text ?? '').join('')
}

/** Project only user and assistant text from a durable DSH event sequence. */
function messagesFrom(events: readonly SessionEvent[]): { role: 'user' | 'assistant'; text: string }[] {
  const messages: { role: 'user' | 'assistant'; text: string }[] = []
  for (const event of events) {
    if (event.type === 'user/message') {
      const data = event.data as { source?: { kind?: unknown }; content?: readonly { type?: string; text?: string }[] }
      if (data.source?.kind !== 'user') continue
      const text = textOf(data.content)
      if (text !== '') messages.push({ role: 'user', text })
    } else if (event.type === 'assistant/message') {
      const message = event.data['message'] as { content?: readonly { type?: string; text?: string }[] } | undefined
      const text = textOf(message?.content)
      if (text !== '') messages.push({ role: 'assistant', text })
    }
  }
  return messages
}

/** Re-wrap a recorded outcome for a replaying request id. */
function wrapOutcome(id: string, outcome: OperationRecord['outcome']): BridgeResponse {
  if (outcome.ok) return { id, ok: true, value: outcome.value }
  return { id, ok: false, error: outcome.error }
}

/** Whether a failure code is terminal enough to record for idempotent replay. */
function isRecordable(code: BridgeErrorCode): boolean {
  return code === 'invalid-request' || code === 'not-found' || code === 'conflict'
}

/** A minimal deferred primitive compatible with the ES2023 target. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

// ── Filesystem and socket helpers ───────────────────────────────────────────

/** Compare capability tokens without leaking a prefix through timing. */
function sameToken(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate)
  const expectedBytes = Buffer.from(expected)
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes)
}

/** Read or atomically initialize the only secret this connector needs. */
async function ensureToken(path: string): Promise<string> {
  try {
    const entry = await lstat(path)
    if (!entry.isFile() || entry.isSymbolicLink() || (entry.mode & 0o077) !== 0) {
      throw new Error(`star-bridge: token file ${JSON.stringify(path)} must be an owner-only regular file`)
    }
    const token = (await readFile(path, 'utf8')).trim()
    if (token.length === 0) throw new Error(`star-bridge: token file ${JSON.stringify(path)} is empty`)
    return token
  } catch (error: unknown) {
    if (!isMissing(error)) throw error
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const token = randomBytes(32).toString('base64url')
  try {
    await writeFile(path, `${token}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    return token
  } catch (error: unknown) {
    if (!isRecord(error) || error['code'] !== 'EEXIST') throw error
    return await ensureToken(path)
  }
}

/** Check that an explicit supervisor cwd is an existing local project directory. */
async function usableDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/** Wait for a Unix-domain socket listener to become ready. */
function listen(server: Server, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    const onListening = (): void => {
      cleanup()
      resolve()
    }
    const cleanup = (): void => {
      server.off('error', onError)
      server.off('listening', onListening)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(path)
  })
}

/** Await the server's close acknowledgement. */
function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => {
      if (error === undefined || error === null) resolve()
      else reject(error)
    })
  })
}

/** Remove only a dead socket left behind by a crashed bridge process. */
async function clearStaleSocket(path: string): Promise<void> {
  let entry: Stats
  try {
    entry = await lstat(path)
  } catch (error: unknown) {
    if (isMissing(error)) return
    throw error
  }
  if (!entry.isSocket()) throw new Error(`star-bridge: socket path ${JSON.stringify(path)} already exists and is not a socket`)
  if (await acceptsConnections(path)) {
    throw new Error(`star-bridge: socket ${JSON.stringify(path)} is already owned by a running bridge`)
  }
  try {
    await unlink(path)
  } catch (error: unknown) {
    if (!isMissing(error)) throw error
  }
}

/** Probe a pre-existing Unix-domain socket without sending a bridge request. */
function acceptsConnections(path: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path)
    const onConnect = (): void => {
      cleanup()
      socket.destroy()
      resolve(true)
    }
    const onError = (error: Error): void => {
      cleanup()
      socket.destroy()
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ECONNREFUSED' || code === 'ENOENT') resolve(false)
      else reject(error)
    }
    const cleanup = (): void => {
      socket.off('connect', onConnect)
      socket.off('error', onError)
    }
    socket.once('connect', onConnect)
    socket.once('error', onError)
  })
}

/** Identify the only expected setup race and preserve all other filesystem errors. */
function isMissing(error: unknown): error is NodeJS.ErrnoException {
  return isRecord(error) && error['code'] === 'ENOENT'
}
