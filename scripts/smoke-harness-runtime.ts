import { spawn, type ChildProcess } from 'node:child_process'
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
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
    const port = await freePort()
    const output: string[] = []
    child = spawn(
      process.execPath,
      [join(artifact, 'image', 'entrypoint.mjs'), '--no-open', '--port', String(port)],
      {
        cwd: workspace,
        env: {
          ...environment,
          DSH_HOME: dshHome,
          DSH_TELEMETRY_DISABLED: '1',
          NODE_OPTIONS: `--import=${guard}`,
          STAR_RUNTIME_ROOT: artifact,
        },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    const origin = await waitForReady(child, output)
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
    process.stdout.write(
      `Harness runtime smoke passed: ${lock.harness.package}@${lock.harness.version}, profile ${lock.harness.profile}, preset ${lock.preset.id}, skills ${actualSkills.join(', ') || '(none)'}\n`,
    )
  } finally {
    if (child) await stop(child)
    if (process.env.STAR_KEEP_RUNTIME_SMOKE !== '1') {
      await rm(work, { force: true, recursive: true })
    } else {
      process.stderr.write(`Preserved runtime smoke directory: ${work}\n`)
    }
  }
}

await main()
