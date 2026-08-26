import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { createConnection, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

interface CapabilityLock {
  apiVersion: string
  harness: { package: string; profile: string; version: string }
  preset: { id: string }
  skills: { name: string }[]
}

function safeEnvironment(root: string): NodeJS.ProcessEnv {
  const home = join(root, 'process-home')
  const temporary = join(root, 'tmp')
  return {
    CI: '1',
    HOME: home,
    LANG: 'C.UTF-8',
    LC_ALL: 'C',
    PATH: process.platform === 'win32' ? (process.env.SystemRoot ?? 'C:\\Windows') : '/usr/bin:/bin',
    TEMP: temporary,
    TMP: temporary,
    TMPDIR: temporary,
    USERPROFILE: home,
  }
}

async function run(
  command: string,
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  await new Promise<void>((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: environment,
      shell: false,
      stdio: ['ignore', 'inherit', 'inherit'],
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun()
      else reject(new Error(`${command} failed (${signal ?? `exit ${String(code)}`})`))
    })
  })
}

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  )
  if (!address || typeof address === 'string') throw new Error('Unable to allocate a smoke port')
  return address.port
}

function waitForReady(child: ChildProcess, output: string[]): Promise<string> {
  return new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`DSH Web did not become ready:\n${output.join('')}`))
    }, 90_000)
    const inspect = (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      output.push(text)
      const match = /dsh web: (http:\/\/[^\s]+)/.exec(output.join(''))
      if (match?.[1]) {
        clearTimeout(timer)
        resolveReady(match[1])
      }
    }
    child.stdout?.on('data', inspect)
    child.stderr?.on('data', inspect)
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      reject(
        new Error(
          `DSH Web exited before readiness (${signal ?? `exit ${String(code)}`}):\n${output.join('')}`,
        ),
      )
    })
  })
}

async function rpc<T>(origin: string, method: string, payload: unknown): Promise<T> {
  const response = await fetch(`${origin}/api/${method}`, {
    body: JSON.stringify({
      method,
      payload,
      rpcId: `star-smoke-${method}`,
      type: 'client-request',
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`)
  const body = (await response.json()) as {
    result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
  }
  if (!body.result.ok) {
    throw new Error(`${method} failed: ${body.result.error.code}: ${body.result.error.message}`)
  }
  return body.result.value
}

interface BridgeEnvelope {
  id: string
  ok: boolean
  value?: unknown
  error?: { code: string; message: string }
}

async function bridgeRequest(
  socketPath: string,
  token: string,
  method: string,
  params: unknown,
  operationId?: string,
): Promise<BridgeEnvelope> {
  return await new Promise<BridgeEnvelope>((resolveRequest, reject) => {
    const socket = createConnection(socketPath)
    const requestId = `star-smoke-${randomUUID()}`
    const request: Record<string, unknown> = {
      version: 1,
      id: requestId,
      token,
      method,
      params,
    }
    if (operationId !== undefined) request['operationId'] = operationId
    let buffered = ''
    const onData = (chunk: Buffer): void => {
      buffered += chunk.toString('utf8')
      const newline = buffered.indexOf('\n')
      if (newline < 0) return
      socket.destroy()
      let envelope: BridgeEnvelope
      try {
        envelope = JSON.parse(buffered.slice(0, newline)) as BridgeEnvelope
      } catch {
        reject(new Error('supervisor bridge returned invalid JSON'))
        return
      }
      if (envelope.id !== requestId) {
        reject(new Error('supervisor bridge response id did not match the request'))
        return
      }
      resolveRequest(envelope)
    }
    socket.on('data', onData)
    socket.once('error', reject)
    socket.once('close', () => reject(new Error('supervisor bridge closed without responding')))
    socket.write(`${JSON.stringify(request)}\n`)
  })
}

function bridgeValue<T>(envelope: BridgeEnvelope, method: string): T {
  if (!envelope.ok) {
    throw new Error(
      `${method} failed: ${envelope.error?.code}: ${envelope.error?.message}`,
    )
  }
  return envelope.value as T
}

function bridgeError(envelope: BridgeEnvelope, expectedCode: string, method: string): void {
  if (envelope.ok) throw new Error(`${method} unexpectedly succeeded`)
  if (envelope.error?.code !== expectedCode) {
    throw new Error(
      `${method} returned ${envelope.error?.code ?? 'unknown'}, expected ${expectedCode}`,
    )
  }
}

async function waitForPath(path: string, timeoutMs = 30_000): Promise<void> {
  const started = Date.now()
  for (;;) {
    try {
      await access(path)
      return
    } catch {
      if (Date.now() - started >= timeoutMs) {
        throw new Error(`path did not appear within ${timeoutMs}ms: ${path}`)
      }
      await new Promise<void>((resolveWait) => setTimeout(resolveWait, 200))
    }
  }
}

interface MockLlm {
  origin: string
  requestCount: () => number
  stop: () => Promise<void>
}

/** Wait until async model-side effects (e.g. session-title generation) settle. */
async function settleModelRequests(model: MockLlm, timeoutMs = 5_000): Promise<number> {
  let previous = model.requestCount()
  const started = Date.now()
  for (;;) {
    await new Promise<void>((resolveWait) => setTimeout(resolveWait, 250))
    const current = model.requestCount()
    if (current === previous) return current
    previous = current
    if (Date.now() - started >= timeoutMs) {
      throw new Error('model requests did not settle')
    }
  }
}

/** OpenAI-compatible streaming mock so `session/prompt` can run a real turn. */
async function startMockLlm(): Promise<MockLlm> {
  let requests = 0
  const server = createHttpServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    if (request.method !== 'POST' || !path.endsWith('/chat/completions')) {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end('{"error":{"message":"not found"}}')
      return
    }
    requests += 1
    response.writeHead(200, {
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
      'content-type': 'text/event-stream',
    })
    response.write('data: {"choices":[{"delta":{"content":"mock reply"},"finish_reason":null}]}\n\n')
    response.write('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n')
    response.write('data: [DONE]\n\n')
    response.end()
  })
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  return {
    origin: `http://127.0.0.1:${port}`,
    requestCount: () => requests,
    stop: () => new Promise<void>((resolveStop, rejectStop) => {
      server.close((error) => (error ? rejectStop(error) : resolveStop()))
    }),
  }
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise<void>((resolveStop, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('DSH Web did not stop after SIGTERM'))
    }, 10_000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolveStop()
    })
    child.kill('SIGTERM')
  })
}

interface BootOptions {
  artifact: string
  dshHome: string
  environment: NodeJS.ProcessEnv
  guard: string
  mockOrigin: string
  workspace: string
}

interface BootedHarness {
  child: ChildProcess
  origin: string
}

/** Boot one Harness process and wait for its Web surface to reach ready. */
async function bootHarness(options: BootOptions): Promise<BootedHarness> {
  const port = await freePort()
  const output: string[] = []
  const child = spawn(
    process.execPath,
    [join(options.artifact, 'image', 'entrypoint.mjs'), '--no-open', '--port', String(port)],
    {
      cwd: options.workspace,
      env: {
        ...options.environment,
        // Route the pinned DeepSeek adapter to the local streaming mock so
        // session/prompt can complete a real turn without a provider key.
        DEEPSEEK_API_KEY: 'mock-key',
        DEEPSEEK_BASE_URL: `${options.mockOrigin}/v1`,
        DSH_HOME: options.dshHome,
        DSH_TELEMETRY_DISABLED: '1',
        NODE_OPTIONS: `--import=${options.guard}`,
        STAR_RUNTIME_ROOT: options.artifact,
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const origin = await waitForReady(child, output)
  return { child, origin }
}

async function main(): Promise<void> {
  const sourceArgument = process.argv[2]
  if (!sourceArgument) {
    throw new Error('Usage: pnpm runtime:smoke <compiled-capability-directory>')
  }
  const source = resolve(sourceArgument)
  await access(join(source, 'capabilities.lock.json'))
  const work = await mkdtemp(join(tmpdir(), 'star-runtime-smoke-'))
  const artifact = join(work, 'artifact')
  const dshHome = join(work, 'dsh-home')
  const workspace = join(work, 'workspace')
  const store = join(work, 'store')
  let child: ChildProcess | undefined
  let mockLlm: MockLlm | undefined
  try {
    await cp(source, artifact, { recursive: true })
    await Promise.all([
      mkdir(dshHome, { recursive: true }),
      mkdir(workspace, { recursive: true }),
      mkdir(join(work, 'process-home'), { recursive: true }),
      mkdir(join(work, 'tmp'), { recursive: true }),
    ])
    const lock = JSON.parse(
      await readFile(join(artifact, 'capabilities.lock.json'), 'utf8'),
    ) as CapabilityLock
    if (lock.apiVersion !== 'star.employee.capabilities/v1alpha1') {
      throw new Error(`Unsupported capability lock: ${lock.apiVersion}`)
    }
    const environment = safeEnvironment(work)
    const runtimeDirectory = join(artifact, 'dsh', 'runtime')
    const pnpm = join(artifact, 'dsh', 'build-tools', 'pnpm', 'bin', 'pnpm.mjs')
    await rm(join(runtimeDirectory, 'node_modules'), { force: true, recursive: true })
    await run(
      process.execPath,
      [pnpm, 'fetch', '--prod', '--frozen-lockfile', '--ignore-scripts', '--store-dir', store],
      runtimeDirectory,
      environment,
    )
    await run(
      process.execPath,
      [
        pnpm,
        'install',
        '--offline',
        '--prod',
        '--frozen-lockfile',
        '--ignore-scripts',
        '--config.auto-install-peers=false',
        '--store-dir',
        store,
      ],
      runtimeDirectory,
      environment,
    )
    await rm(join(artifact, 'dsh', 'build-tools'), { force: true, recursive: true })

    const guard = join(work, 'deny-outbound.mjs')
    await writeFile(
      guard,
      `import net from 'node:net'
const connect = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  const first = args[0]
  if (first && typeof first === 'object' && 'path' in first) return Reflect.apply(connect, this, args)
  const host = first && typeof first === 'object'
    ? first.host
    : typeof args[1] === 'string' ? args[1] : undefined
  if (host !== undefined && !['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error('Star runtime smoke blocked outbound connection to ' + host)
  }
  return Reflect.apply(connect, this, args)
}
`,
      'utf8',
    )
    mockLlm = await startMockLlm()
    const first = await bootHarness({
      artifact,
      dshHome,
      environment,
      guard,
      mockOrigin: mockLlm.origin,
      workspace,
    })
    child = first.child
    const origin = first.origin
    const roster = await rpc<{
      presets: { broken?: string; id: string; isDefault: boolean }[]
    }>(origin, 'agentPreset.list', {})
    const preset = roster.presets.find((entry) => entry.id === lock.preset.id)
    if (!preset || preset.broken || !preset.isDefault) {
      throw new Error(`Locked preset is unavailable, broken, or not default: ${JSON.stringify(preset)}`)
    }
    const session = await rpc<{ agentPreset?: string; sessionId: string }>(
      origin,
      'session.create',
      { agentPreset: lock.preset.id, cwd: workspace },
    )
    if (session.agentPreset !== lock.preset.id) {
      throw new Error(`Session selected ${String(session.agentPreset)}, expected ${lock.preset.id}`)
    }
    const catalog = await rpc<{ skills: { name: string }[] }>(origin, 'skill.list', {
      sessionId: session.sessionId,
    })
    const actualSkills = catalog.skills.map((skill) => skill.name).sort()
    const expectedSkills = lock.skills.map((skill) => skill.name).sort()
    if (JSON.stringify(actualSkills) !== JSON.stringify(expectedSkills)) {
      throw new Error(
        `Runtime exposed skills ${JSON.stringify(actualSkills)}, expected ${JSON.stringify(expectedSkills)}`,
      )
    }

    // Supervisor-bridge conformance: the compiled profile loads the bridge row,
    // whose owner-only socket and capability token live under $DSH_HOME.
    const bridgeRoot = join(dshHome, 'star-bridge')
    const bridgeSocket = join(bridgeRoot, 'socket')
    await waitForPath(bridgeSocket)
    const bridgeToken = (await readFile(join(bridgeRoot, 'token'), 'utf8')).trim()
    if (bridgeToken === '') throw new Error('supervisor bridge wrote an empty capability token')

    const created = bridgeValue<{ sessionId: string; presetId: string; activity: string }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/create',
        { cwd: workspace },
        'smoke-create',
      ),
      'session/create',
    )
    if (created.presetId !== lock.preset.id) {
      throw new Error(`Bridge selected preset ${created.presetId}, expected ${lock.preset.id}`)
    }
    if (created.activity !== 'idle') {
      throw new Error(`Bridge session started ${created.activity}, expected idle`)
    }

    const replayed = bridgeValue<{ sessionId: string }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/create',
        { cwd: workspace },
        'smoke-create',
      ),
      'session/create replay',
    )
    if (replayed.sessionId !== created.sessionId) {
      throw new Error('Replayed operation id created a second bridge session')
    }

    const listed = bridgeValue<{ sessionId: string }[]>(
      await bridgeRequest(bridgeSocket, bridgeToken, 'session/list', {}),
      'session/list',
    )
    if (listed.length !== 1 || listed[0]?.sessionId !== created.sessionId) {
      throw new Error(
        `Bridge listed ${JSON.stringify(listed)}, expected only ${created.sessionId}`,
      )
    }

    const statusIdle = bridgeValue<{ activity: string }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/status',
        { sessionId: created.sessionId },
      ),
      'session/status',
    )
    if (statusIdle.activity !== 'idle') {
      throw new Error(`Bridge status reported ${statusIdle.activity}, expected idle`)
    }

    const observed = bridgeValue<{ events: unknown[]; nextSeq: number }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/observe',
        { sessionId: created.sessionId },
      ),
      'session/observe',
    )
    if (observed.events.length !== 0 || observed.nextSeq !== 0) {
      throw new Error(`Bridge observe expected an empty log, got ${JSON.stringify(observed)}`)
    }

    const resumedLive = bridgeValue<{ activity: string }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/resume',
        { sessionId: created.sessionId },
        'smoke-resume-live',
      ),
      'session/resume (live)',
    )
    if (resumedLive.activity !== 'idle') {
      throw new Error(`Bridge live resume reported ${resumedLive.activity}, expected idle`)
    }

    const cancelled = bridgeValue<{ accepted: boolean }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/cancel',
        { sessionId: created.sessionId },
        'smoke-cancel',
      ),
      'session/cancel',
    )
    if (!cancelled.accepted) throw new Error('session/cancel rejected an idle bridge session')

    const disposed = bridgeValue<{ accepted: boolean }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/dispose',
        { sessionId: created.sessionId },
        'smoke-dispose',
      ),
      'session/dispose',
    )
    if (!disposed.accepted) throw new Error('session/dispose rejected a bridge-owned session')

    const statusInactive = bridgeValue<{ activity: string }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/status',
        { sessionId: created.sessionId },
      ),
      'session/status after dispose',
    )
    if (statusInactive.activity !== 'inactive') {
      throw new Error(`Bridge status after dispose reported ${statusInactive.activity}, expected inactive`)
    }

    const coldResumed = bridgeValue<{ activity: string }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/resume',
        { sessionId: created.sessionId },
        'smoke-resume-cold',
      ),
      'session/resume (cold)',
    )
    if (coldResumed.activity !== 'idle') {
      throw new Error(`Bridge cold resume reported ${coldResumed.activity}, expected idle`)
    }

    bridgeError(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/status',
        { sessionId: 'star-not-owned' },
      ),
      'not-found',
      'session/status on a foreign session',
    )
    bridgeError(
      await bridgeRequest(bridgeSocket, bridgeToken, 'session/create', { cwd: workspace }),
      'invalid-request',
      'session/create without an operation id',
    )
    bridgeError(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/prompt',
        { sessionId: created.sessionId, text: 'hello' },
      ),
      'invalid-request',
      'session/prompt without an operation id',
    )
    bridgeError(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/prompt',
        { sessionId: created.sessionId, text: '' },
        'smoke-prompt-empty',
      ),
      'invalid-request',
      'session/prompt with empty text',
    )

    // session/prompt must run a real turn through the pinned adapter, settle at
    // turn/end, and deduplicate on operation-id replay without a second call.
    const prompted = bridgeValue<{
      stopReason: string
      messages: { role: string; text: string }[]
      turn: number
    }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/prompt',
        { sessionId: created.sessionId, text: 'hello' },
        'smoke-prompt',
      ),
      'session/prompt',
    )
    if (prompted.stopReason !== 'end_turn') {
      throw new Error(`session/prompt stopped with ${prompted.stopReason}, expected end_turn`)
    }
    if (prompted.messages.length !== 1 || prompted.messages[0]?.text !== 'mock reply') {
      throw new Error(
        `session/prompt returned ${JSON.stringify(prompted.messages)}, expected the mock reply`,
      )
    }
    // The turn itself and any async model-side effects (session-title
    // generation) settle before we assert idempotent replay.
    const requestsAfterPrompt = await settleModelRequests(mockLlm!)

    const replayedPrompt = bridgeValue<{
      stopReason: string
      messages: { role: string; text: string }[]
      turn: number
    }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/prompt',
        { sessionId: created.sessionId, text: 'hello' },
        'smoke-prompt',
      ),
      'session/prompt replay',
    )
    if (JSON.stringify(replayedPrompt) !== JSON.stringify(prompted)) {
      throw new Error('Replayed prompt did not return the recorded result')
    }
    if (mockLlm!.requestCount() !== requestsAfterPrompt) {
      throw new Error(
        `Replayed prompt made a new model request (${mockLlm!.requestCount()} != ${requestsAfterPrompt})`,
      )
    }

    const observedTurn = bridgeValue<{ events: unknown[]; nextSeq: number }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/observe',
        { sessionId: created.sessionId },
      ),
      'session/observe after prompt',
    )
    if (observedTurn.events.length === 0) {
      throw new Error('session/observe returned no events after a completed turn')
    }
    const history = bridgeValue<{ messages: { role: string; text: string }[] }>(
      await bridgeRequest(
        bridgeSocket,
        bridgeToken,
        'session/history',
        { sessionId: created.sessionId },
      ),
      'session/history',
    )
    if (!history.messages.some((message) => message.role === 'assistant' && message.text === 'mock reply')) {
      throw new Error(`session/history missed the assistant reply: ${JSON.stringify(history.messages)}`)
    }

    // The bridge-created session must be an ordinary DSH session: visible in
    // Web, composed from the locked preset, and exposing exactly the locked skills.
    const webSessions = await rpc<{
      items: { sessionId: string; agentPreset?: string }[]
    }>(origin, 'session.list', {})
    const bridgeWebSession = webSessions.items.find(
      (entry) => entry.sessionId === created.sessionId,
    )
    if (!bridgeWebSession || bridgeWebSession.agentPreset !== lock.preset.id) {
      throw new Error(
        `Bridge session is not visible in DSH Web with the locked preset: ${JSON.stringify(bridgeWebSession)}`,
      )
    }
    const bridgeCatalog = await rpc<{ skills: { name: string }[] }>(origin, 'skill.list', {
      sessionId: created.sessionId,
    })
    const bridgeSkills = bridgeCatalog.skills.map((skill) => skill.name).sort()
    if (JSON.stringify(bridgeSkills) !== JSON.stringify(expectedSkills)) {
      throw new Error(
        `Bridge session exposed skills ${JSON.stringify(bridgeSkills)}, expected ${JSON.stringify(expectedSkills)}`,
      )
    }

    // Cold restart: the ownership registry and operation ledger live under
    // $DSH_HOME and must survive process replacement, so a replayed operation
    // id after restart returns the recorded outcome instead of re-executing.
    await stop(first.child)
    child = undefined
    const second = await bootHarness({
      artifact,
      dshHome,
      environment,
      guard,
      mockOrigin: mockLlm!.origin,
      workspace,
    })
    child = second.child
    const secondBridgeSocket = join(dshHome, 'star-bridge', 'socket')
    await waitForPath(secondBridgeSocket)
    const secondBridgeToken = (await readFile(join(dshHome, 'star-bridge', 'token'), 'utf8')).trim()

    const replayedCreateAfterRestart = bridgeValue<{ sessionId: string }>(
      await bridgeRequest(
        secondBridgeSocket,
        secondBridgeToken,
        'session/create',
        { cwd: workspace },
        'smoke-create',
      ),
      'session/create replay after restart',
    )
    if (replayedCreateAfterRestart.sessionId !== created.sessionId) {
      throw new Error('Replayed create after restart returned a different session')
    }
    const listedAfterRestart = bridgeValue<{ sessionId: string }[]>(
      await bridgeRequest(secondBridgeSocket, secondBridgeToken, 'session/list', {}),
      'session/list after restart',
    )
    if (listedAfterRestart.length !== 1 || listedAfterRestart[0]?.sessionId !== created.sessionId) {
      throw new Error(
        `session/list after restart listed ${JSON.stringify(listedAfterRestart)}, expected only ${created.sessionId}`,
      )
    }

    const requestsBeforePromptReplay = mockLlm!.requestCount()
    const replayedPromptAfterRestart = bridgeValue<{
      stopReason: string
      messages: { role: string; text: string }[]
      turn: number
    }>(
      await bridgeRequest(
        secondBridgeSocket,
        secondBridgeToken,
        'session/prompt',
        { sessionId: created.sessionId, text: 'hello' },
        'smoke-prompt',
      ),
      'session/prompt replay after restart',
    )
    if (JSON.stringify(replayedPromptAfterRestart) !== JSON.stringify(prompted)) {
      throw new Error('Replayed prompt after restart did not return the recorded result')
    }
    if (mockLlm!.requestCount() !== requestsBeforePromptReplay) {
      throw new Error(
        `Replayed prompt after restart made a new model request (${mockLlm!.requestCount()} != ${requestsBeforePromptReplay})`,
      )
    }

    process.stdout.write(
      `Harness runtime smoke passed: ${lock.harness.package}@${lock.harness.version}, profile ${lock.harness.profile}, preset ${lock.preset.id}, skills ${actualSkills.join(', ') || '(none)'}, bridge ${created.sessionId}, restart-replay ok\n`,
    )
  } finally {
    if (child) await stop(child)
    if (mockLlm) await mockLlm.stop()
    if (process.env.STAR_KEEP_RUNTIME_SMOKE !== '1') {
      await rm(work, { force: true, recursive: true })
    } else {
      process.stderr.write(`Preserved runtime smoke directory: ${work}\n`)
    }
  }
}

await main()
