import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  validateEmployeeRecipe,
  type CapabilityLock,
  type EmployeeRecipe,
} from '@star/employee-contracts'
import * as tar from 'tar'
import { parse, stringify } from 'yaml'
import { dockerfileSource, runtimeEntrypointSource } from './image.js'

const SKILL_MANAGER = {
  contentDigest:
    'sha256:9bb08d2fa5128acb9914ef5f719fb9f759229fc64da639a2bf6f5a8da42882dd' as const,
  integrity:
    'sha512-+hMNBSi35yfX0sKD+ZcRm9y5or7u313OdkcvrRvJAsAzGCaA8wRTu2OmVdN0KRbk9ybqKby5dijkn6OVvNTUmw==' as const,
  package: 'skills' as const,
  version: '1.5.23' as const,
}
const PACKAGE_MANAGER = {
  contentDigest:
    'sha256:56a89bfc6bfdd52bfafcc2e42383d28dd0699abd979c9f04fb2a30794a17eb09' as const,
  integrity:
    'sha512-GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA==' as const,
  package: 'pnpm' as const,
  version: '11.7.0' as const,
}
// Required peers omitted from the published @deepseek-ai/dsh dependency closure.
const DSH_RUNTIME_SUPPORT = {
  '@deepseek-ai/cordis-plugin-group': {
    integrity:
      'sha512-E1NThkFB3jn3TCqa6Oc++1zQHqLejF3W2wDwv2BlL3UEmgtBXL1K1j1koc+j676RuiOXtJkUJlPcOntRGKLWBQ==',
    version: '1.0.1',
  },
  '@deepseek-ai/dsh-anonymous-user-id': {
    integrity:
      'sha512-ZQBsDhI0VuFwoDnq75VT2gPJdMPmBYfWM3EBDmUkwHM0E2dmyr+iLGXxp33a7M64r79x7kN+81KOTEL5LS0E8A==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-atomic-write': {
    integrity:
      'sha512-QqNSF0+Ddn6qWY480dlilwEy6FLv3JKEWx1UQgoNJrxD4y54SDRzqBQB9yDXWKOoOGyC+05TN6/Px10GNIzMWA==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-authorization': {
    integrity:
      'sha512-+ye7d4XzenQ4kpfY2nMIlUhoIbcprotL9fmkTBahafIPDhyyph0JzmUVhz1AGnkIqZc8TltjGzX2ssald+f+3A==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-bash-local': {
    integrity:
      'sha512-GAjYTVsJKXkAptjO767xqt0otMufZRtj2qvOAvkx5Bfusd5R6+mMUkSbcx2K2A8WMbltyCbjwhZf4Tu4xyJAdw==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-code-runtime': {
    integrity:
      'sha512-SgFresqH5UABzRQZ7tOfqzOLMHF7089VeH+mfcwNQH5peOavgEKrAGOYz/9RnISH0XmMrj/x177t8gfO8Uvo/w==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-compaction': {
    integrity:
      'sha512-LV5GAIx7GO8DCRivnN2bmLmuucsYDG+ifG18BaXBqsVKdrzmaIu5o+CBxQAI2bX1N6mfBenLxmvCnROkyumLTg==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-fs': {
    integrity:
      'sha512-8j+6MffvCHATLQrhAVfc9rKyunKu/O7mjjJzmdsUSdID7V4iUYMwqPamhlAyI+tfohZu/vcforKzCRIZGmCYug==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-invariants': {
    integrity:
      'sha512-l+1Om/EDFyMjhgSuEx2WDLLA2fia/+ga9mBTCoT/MMslsnWaK5G0/lWwbwlTBSaJ6OfmYc3DuBgox8DbgIGHRQ==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-output-retention': {
    integrity:
      'sha512-tCni+bTEp/FWokfz3fqn4p6SzHn6pkY6H3HkS9UY5PHrztUE1ESUQUp41kIVtwUhRmJU7yissqjxe6kLDB6t2Q==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-sandbox': {
    integrity:
      'sha512-rnO2RqZ+ycpwrXrXlMcrhWAICdui3ZVTjNQ8eZrOPE18hAbX3tw0nLFq26sBjMSnBfDQHNZ4VaFpt0p8qhkPWQ==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-scope': {
    integrity:
      'sha512-Xy3ejL6dwVSluZL7XOWy76ya4pCw1uHwxodDK4O9XiQUiUV4FBXnt0aNJUtMeAFN0c1YujxxCmRniMvuuNn1Nw==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-session-telemetry': {
    integrity:
      'sha512-yYNUtpxykp10m6YVCcfmxtfiRZeNr9g+Mg5/37oO6W5Fs9A6L3vfCM4Ppn47lwLbQetejsR1QClV4P4I//c01g==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-session-title-llm': {
    integrity:
      'sha512-UTdH4h5zuMsNDSEAa3xp6YsfVbLRCCkm/0uBt8wKhu7+rWh7OCgvAgvvwaIKEGST8/8NWC6ogdT2GFNCX4WizQ==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-shell': {
    integrity:
      'sha512-gEqPUxKOpOV66wvM4o8Z5FEuWmsEvYzD9OQy3cyo/kjzlx+2+KUWi22cl/YWtBs/zUtRJbdG5UqMnh8GUeO8Hg==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-spill': {
    integrity:
      'sha512-iayBN51zRj0+ER6KKJM6UlN1dfKXe5eDJeSwYmH+j3wLbCBQTD7Axnhmo9t68JBRrg+eczg2epFMR5RrXrisUQ==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-subagent-in-process-driver': {
    integrity:
      'sha512-+GCNjPnRJOB4fv6pc4b9qQZvzoluH9neOLCrKEpJsoNn1c2XCQMaylc8G+WEziIbvzDvHcpKJJWm50XlKuDfMg==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-timeout': {
    integrity:
      'sha512-RrouVgU3G5gXr9zHhpThkMG6YKdcRJzXXdPm1dq3ioBxbvxlfMSfNY4tN8lWMJxLyGtvWkPra0HQX+YWxvdOOA==',
    version: '0.1.1-rc.2',
  },
  '@deepseek-ai/dsh-workflow': {
    integrity:
      'sha512-YHUGOBfHGXVr9RRAdCvKZ/1SeeKx4jRumSBMNJo1ETbVqEK+ov2kV61pHFfLu1h+heCsEbOsEJeVXvgYC8EBhw==',
    version: '0.1.1-rc.2',
  },
  react: {
    integrity:
      'sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ==',
    version: '18.3.1',
  },
  'react-dom': {
    integrity:
      'sha512-5m4nQKp+rZRb09LNH59GM4BxTh9251/ylbKIbpe7TpGxfJ+9kv6BLkLBXIjjspbgbnIBNqlI23tRnTWT0snUIw==',
    version: '18.3.1',
  },
} as const
// Derived from integrity-verified npm archives, excluding package-manager install links.
const MINIPASS_RUNTIME = {
  contentDigest: 'sha256:c3b02adbacef5635eb4b5eaae350b667a9b4added839b45eeef3420bd688a591',
  package: 'minipass',
  version: '7.1.3',
} as const
const SKILL_MANAGER_RUNTIME_DEPENDENCIES: readonly LockedToolPackage[] = [
  {
    contentDigest: 'sha256:f672279618a322ebb6dda7eb7da570af22170f72875dffdc95aa30900a18307a',
    dependencies: [
      {
        contentDigest:
          'sha256:48c263dfe9e5faf8ba03772cda248088413949758a6e980c8c55bdff9b8384dc',
        dependencies: [MINIPASS_RUNTIME],
        package: '@isaacs/fs-minipass',
        version: '4.0.1',
      },
      {
        contentDigest:
          'sha256:e136a2eb87b4bb90478b26322bb4d2ee05d24d4bc9db5ef782538f091d28ed72',
        package: 'chownr',
        version: '3.0.0',
      },
      MINIPASS_RUNTIME,
      {
        contentDigest:
          'sha256:3c03db411200a66b7fa81c2ab88addfac4462013196ebd821cf6e74fbd87e4e6',
        dependencies: [MINIPASS_RUNTIME],
        package: 'minizlib',
        version: '3.1.0',
      },
      {
        contentDigest:
          'sha256:26455d4f0db5ca30c777faa0dceafd40299d52ede462b84d2397491c5d5601a3',
        package: 'yallist',
        version: '5.0.0',
      },
    ],
    package: 'tar',
    version: '7.5.20',
  },
  {
    contentDigest: 'sha256:69a82379c865309dbc225e2beb8613adb633f2588072bfdfe098f8b3034044b1',
    package: 'yaml',
    version: '2.9.0',
  },
]
const DEFAULT_GIT_EXECUTABLE =
  process.platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : '/usr/bin/git'
const MAX_NPM_TARBALL_BYTES = 100 * 1024 * 1024
const MAX_NPM_EXTRACTED_BYTES = 512 * 1024 * 1024
const MAX_NPM_ARCHIVE_ENTRIES = 100_000
const require = createRequire(import.meta.url)

type RecipeSkill = NonNullable<EmployeeRecipe['spec']['skills']>[number]
type RecipePlugin = NonNullable<EmployeeRecipe['spec']['plugins']>[number]
type Fetch = typeof globalThis.fetch

interface CommandOptions {
  cwd: string
  env: NodeJS.ProcessEnv
}

interface NpmMetadata {
  integrity: string
  package: string
  tarball: string
  version: string
}

interface MaterializedSkillSource {
  root: string
  lockSource: CapabilityLock['skills'][number]['source']
}

interface LockedToolPackage {
  contentDigest: string
  dependencies?: readonly LockedToolPackage[]
  package: string
  version: string
}

export interface CompileCapabilitiesOptions {
  allowedGitHosts?: readonly string[]
  fetch?: Fetch
  generateRuntimeLock?: RuntimeLockGenerator
  gitExecutable?: string
  outputDirectory: string
  recipe: EmployeeRecipe
  recipePath: string
  registryUrl?: string
}

export interface CompileCapabilitiesResult {
  lock: CapabilityLock
  outputDirectory: string
}

export interface RuntimeDirectPackage {
  integrity: string
  package: string
  version: string
}

export interface RuntimeLockGeneratorOptions {
  directPackages: readonly RuntimeDirectPackage[]
  environment: NodeJS.ProcessEnv
  registryUrl: string
  runtimeDirectory: string
}

export type RuntimeLockGenerator = (
  options: RuntimeLockGeneratorOptions,
) => Promise<void>

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function isolatedBuildEnvironment(root: string): Promise<NodeJS.ProcessEnv> {
  const home = join(root, 'home')
  const temporary = join(root, 'tmp')
  const xdgCache = join(root, 'cache')
  const xdgConfig = join(root, 'config')
  await Promise.all(
    [home, temporary, xdgCache, xdgConfig].map((path) =>
      mkdir(path, { recursive: true }),
    ),
  )
  const environment: NodeJS.ProcessEnv = {
    CI: '1',
    HOME: home,
    LANG: process.env.LANG ?? 'C.UTF-8',
    LC_ALL: 'C',
    PATH:
      process.platform === 'win32'
        ? `${join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')};${process.env.SystemRoot ?? 'C:\\Windows'}`
        : '/usr/bin:/bin',
    TEMP: temporary,
    TMP: temporary,
    TMPDIR: temporary,
    USERPROFILE: home,
    XDG_CACHE_HOME: xdgCache,
    XDG_CONFIG_HOME: xdgConfig,
  }
  if (process.platform === 'win32') {
    environment.ComSpec = process.env.ComSpec
    environment.PATHEXT = process.env.PATHEXT
    environment.SystemRoot = process.env.SystemRoot
  }
  return environment
}

async function runCommand(
  command: string,
  args: string[],
  options: CommandOptions,
): Promise<string> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolveCommand(Buffer.concat(stdout).toString('utf8'))
        return
      }
      const detail = Buffer.concat(stderr).toString('utf8').trim()
      reject(
        new Error(
          `${basename(command)} failed (${signal ?? `exit ${code ?? 'unknown'}`})${detail ? `: ${detail}` : ''}`,
        ),
      )
    })
  })
}

function sha256(value: string | Buffer): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => compareText(left, right))
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

async function assertNoSourceSymlinks(root: string): Promise<void> {
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        throw new Error(`Capability source contains a symlink: ${relative(root, path)}`)
      }
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue
        await visit(path)
        continue
      }
      if (!entry.isFile()) {
        throw new Error(`Capability source contains a special file: ${relative(root, path)}`)
      }
    }
  }

  const rootStat = await lstat(root)
  if (rootStat.isSymbolicLink()) throw new Error('Capability source root is a symlink')
  if (!rootStat.isDirectory()) throw new Error(`Capability source is not a directory: ${root}`)
  await visit(root)
}

async function treeDigest(root: string): Promise<`sha256:${string}`> {
  const hash = createHash('sha256').update('star-tree-v1\0')

  async function visit(directory: string, prefix: string): Promise<void> {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      compareText(left.name, right.name),
    )
    for (const entry of entries) {
      const path = join(directory, entry.name)
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      const fileStat = await lstat(path)
      if (fileStat.isSymbolicLink()) {
        throw new Error(`Compiled skill contains a symlink: ${relativePath}`)
      }
      if (fileStat.isDirectory()) {
        hash.update(`d\0${relativePath}\0`)
        await visit(path, relativePath)
        continue
      }
      if (!fileStat.isFile()) {
        throw new Error(`Compiled skill contains a special file: ${relativePath}`)
      }
      const mode = fileStat.mode & 0o111 ? '755' : '644'
      const contents = await readFile(path)
      hash.update(`f\0${relativePath}\0${mode}\0${contents.byteLength}\0`)
      hash.update(contents)
      hash.update('\0')
    }
  }

  await visit(root, '')
  return `sha256:${hash.digest('hex')}`
}

async function toolPackageContentDigest(root: string): Promise<`sha256:${string}`> {
  const hash = createHash('sha256').update('star-package-content-v1\0')

  async function visit(directory: string, prefix: string): Promise<void> {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      compareText(left.name, right.name),
    )
    for (const entry of entries) {
      if (prefix === '' && entry.name === 'node_modules' && entry.isDirectory()) continue
      const path = join(directory, entry.name)
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      const fileStat = await lstat(path)
      if (fileStat.isSymbolicLink()) {
        throw new Error(`Installed build tool contains a symlink: ${relativePath}`)
      }
      if (fileStat.isDirectory()) {
        await visit(path, relativePath)
        continue
      }
      if (!fileStat.isFile()) {
        throw new Error(`Installed build tool contains a special file: ${relativePath}`)
      }
      const contents = await readFile(path)
      hash.update(`f\0${relativePath}\0${contents.byteLength}\0`)
      hash.update(contents)
      hash.update('\0')
    }
  }

  const rootStat = await lstat(root)
  if (!rootStat.isDirectory()) throw new Error(`Installed build tool is not a directory: ${root}`)
  await visit(root, '')
  return `sha256:${hash.digest('hex')}`
}

async function normalizeTreeModes(root: string): Promise<void> {
  async function visit(directory: string): Promise<void> {
    await chmod(directory, 0o755)
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(directory, entry.name)
      const fileStat = await lstat(path)
      if (fileStat.isSymbolicLink()) {
        throw new Error(`Compiled skill contains a symlink: ${relative(root, path)}`)
      }
      if (fileStat.isDirectory()) {
        await visit(path)
        continue
      }
      if (!fileStat.isFile()) {
        throw new Error(`Compiled skill contains a special file: ${relative(root, path)}`)
      }
      await chmod(path, fileStat.mode & 0o111 ? 0o755 : 0o644)
    }
  }

  await visit(root)
}

async function snapshotLocalSource(source: string, destination: string): Promise<string> {
  await assertNoSourceSymlinks(source)
  await cp(source, destination, {
    filter: (path) => {
      const fromRoot = relative(source, path)
      if (fromRoot === '') return true
      return !fromRoot
        .split(sep)
        .some((segment) => segment === '.git' || segment === 'node_modules')
    },
    recursive: true,
    verbatimSymlinks: true,
  })
  await assertNoSourceSymlinks(destination)
  return destination
}

function containedPath(root: string, subpath?: string): string {
  const path = resolve(root, subpath ?? '.')
  const fromRoot = relative(root, path)
  if (fromRoot === '' || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..' && !isAbsolute(fromRoot))) {
    return path
  }
  throw new Error(`Capability subpath escapes its source root: ${subpath ?? '.'}`)
}

function pathIsWithin(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate)
  return (
    fromRoot === '' ||
    (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..' && !isAbsolute(fromRoot))
  )
}

async function resolveFuturePath(path: string): Promise<string> {
  let existingAncestor = resolve(path)
  const missingSegments: string[] = []
  while (!(await pathExists(existingAncestor))) {
    const parent = dirname(existingAncestor)
    if (parent === existingAncestor) break
    missingSegments.unshift(basename(existingAncestor))
    existingAncestor = parent
  }
  return resolve(await realpath(existingAncestor), ...missingSegments)
}

async function resolveNpmMetadata(
  packageName: string,
  version: string,
  registryUrl: string,
  fetcher: Fetch,
): Promise<NpmMetadata> {
  const registry = new URL(registryUrl)
  if (registry.protocol !== 'https:' || registry.username || registry.password) {
    throw new Error('The npm registry must be a credential-free HTTPS URL')
  }
  const base = registry.href.endsWith('/') ? registry.href : `${registry.href}/`
  const endpoint = new URL(
    `${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`,
    base,
  )
  const response = await fetcher(endpoint, {
    headers: { accept: 'application/json' },
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error(
      `Unable to resolve ${packageName}@${version}: registry returned ${response.status}`,
    )
  }
  const candidate = (await response.json()) as {
    dist?: { integrity?: unknown; tarball?: unknown }
    name?: unknown
    version?: unknown
  }
  if (candidate.name !== packageName || candidate.version !== version) {
    throw new Error(`Registry returned the wrong identity for ${packageName}@${version}`)
  }
  if (
    typeof candidate.dist?.integrity !== 'string' ||
    !/^sha512-[A-Za-z0-9+/]{86}==$/.test(candidate.dist.integrity)
  ) {
    throw new Error(`${packageName}@${version} does not publish one SHA-512 integrity`)
  }
  if (typeof candidate.dist.tarball !== 'string') {
    throw new Error(`${packageName}@${version} does not publish a tarball URL`)
  }
  const tarball = new URL(candidate.dist.tarball)
  if (tarball.protocol !== 'https:' || tarball.username || tarball.password) {
    throw new Error(`${packageName}@${version} publishes an unsafe tarball URL`)
  }

  return {
    integrity: candidate.dist.integrity,
    package: packageName,
    tarball: tarball.href,
    version,
  }
}

async function extractNpmPackage(
  metadata: NpmMetadata,
  destination: string,
  fetcher: Fetch,
): Promise<string> {
  const response = await fetcher(metadata.tarball, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(
      `Unable to download ${metadata.package}@${metadata.version}: ${response.status}`,
    )
  }
  if (!response.url.startsWith('https://')) {
    throw new Error(`${metadata.package}@${metadata.version} redirected outside HTTPS`)
  }
  const declaredSize = Number(response.headers.get('content-length') ?? 0)
  if (declaredSize > MAX_NPM_TARBALL_BYTES) {
    throw new Error(`${metadata.package}@${metadata.version} exceeds the tarball size limit`)
  }
  const archive = Buffer.from(await response.arrayBuffer())
  if (archive.byteLength > MAX_NPM_TARBALL_BYTES) {
    throw new Error(`${metadata.package}@${metadata.version} exceeds the tarball size limit`)
  }
  const actualIntegrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`
  if (actualIntegrity !== metadata.integrity) {
    throw new Error(`Integrity mismatch for ${metadata.package}@${metadata.version}`)
  }

  const archivePath = join(destination, 'package.tgz')
  const packageRoot = join(destination, 'package')
  let rejectedArchiveEntry: string | undefined
  let archiveEntries = 0
  let extractedBytes = 0
  await mkdir(packageRoot, { recursive: true })
  await writeFile(archivePath, archive)
  await tar.x({
    cwd: packageRoot,
    file: archivePath,
    filter: (path, entry) => {
      archiveEntries += 1
      if (archiveEntries > MAX_NPM_ARCHIVE_ENTRIES) {
        throw new Error(
          `${metadata.package}@${metadata.version} exceeds the archive entry limit`,
        )
      }
      const type = 'type' in entry ? entry.type : undefined
      const accepted = type === 'File' || type === 'OldFile' || type === 'Directory'
      if (!accepted && !rejectedArchiveEntry) rejectedArchiveEntry = path
      if (type === 'File' || type === 'OldFile') {
        const size = 'size' in entry ? Number(entry.size) : Number.NaN
        if (!Number.isSafeInteger(size) || size < 0) {
          throw new Error(
            `${metadata.package}@${metadata.version} has an invalid archive entry size`,
          )
        }
        extractedBytes += size
        if (extractedBytes > MAX_NPM_EXTRACTED_BYTES) {
          throw new Error(
            `${metadata.package}@${metadata.version} exceeds the extracted size limit`,
          )
        }
      }
      return accepted
    },
    preservePaths: false,
    strict: true,
    strip: 1,
  })
  if (rejectedArchiveEntry) {
    throw new Error(
      `${metadata.package}@${metadata.version} contains an unsupported archive entry: ${rejectedArchiveEntry}`,
    )
  }
  await assertNoSourceSymlinks(packageRoot)
  return packageRoot
}

async function materializeGitSource(
  repository: string,
  revision: string,
  destination: string,
  environment: NodeJS.ProcessEnv,
  gitExecutable: string,
): Promise<string> {
  await mkdir(destination, { recursive: true })
  const env: NodeJS.ProcessEnv = {
    ...environment,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_LFS_SKIP_SMUDGE: '1',
    GIT_TERMINAL_PROMPT: '0',
  }
  await runCommand(gitExecutable, ['init', '--quiet'], { cwd: destination, env })
  await runCommand(gitExecutable, ['remote', 'add', 'origin', repository], {
    cwd: destination,
    env,
  })
  await runCommand(
    gitExecutable,
    [
      '-c',
      'protocol.file.allow=never',
      '-c',
      'core.hooksPath=/dev/null',
      'fetch',
      '--depth=1',
      '--no-tags',
      'origin',
      revision,
    ],
    { cwd: destination, env },
  )
  await runCommand(
    gitExecutable,
    ['-c', 'core.hooksPath=/dev/null', 'checkout', '--quiet', '--detach', 'FETCH_HEAD'],
    { cwd: destination, env },
  )
  const resolvedRevision = (
    await runCommand(gitExecutable, ['rev-parse', 'HEAD'], { cwd: destination, env })
  ).trim()
  if (resolvedRevision !== revision) {
    throw new Error(`Git resolved ${repository} to ${resolvedRevision}, expected ${revision}`)
  }
  await rm(join(destination, '.git'), { force: true, recursive: true })
  return destination
}

async function validateInstalledSkill(root: string, expectedName: string): Promise<void> {
  await assertNoSourceSymlinks(root)
  const source = await readFile(join(root, 'SKILL.md'), 'utf8')
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
  if (!match) throw new Error(`Skill ${expectedName} has no YAML frontmatter`)
  const frontmatter = parse(match[1] ?? '') as { description?: unknown; name?: unknown }
  if (frontmatter.name !== expectedName) {
    throw new Error(`Skill ${expectedName} frontmatter name does not match its selection`)
  }
  if (typeof frontmatter.description !== 'string' || frontmatter.description.trim() === '') {
    throw new Error(`Skill ${expectedName} has no description`)
  }
}

function runtimeExportTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(runtimeExportTargets)
  if (!value || typeof value !== 'object') return []

  const conditions = value as Record<string, unknown>
  for (const [condition, target] of Object.entries(conditions)) {
    if (condition === 'node' || condition === 'import' || condition === 'default') {
      return runtimeExportTargets(target)
    }
  }
  return []
}

async function validatePluginEntry(
  packageRoot: string,
  plugin: RecipePlugin,
): Promise<void> {
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as {
    exports?: unknown
    main?: unknown
    module?: unknown
    name?: unknown
    version?: unknown
  }
  if (manifest.name !== plugin.package || manifest.version !== plugin.version) {
    throw new Error(
      `Packed plugin identity does not match ${plugin.package}@${plugin.version}`,
    )
  }

  const subpath =
    plugin.entry === plugin.package ? '.' : `.${plugin.entry.slice(plugin.package.length)}`
  let exportValue: unknown
  if (manifest.exports === undefined) {
    if (subpath === '.') {
      const main =
        typeof manifest.module === 'string'
          ? manifest.module
          : typeof manifest.main === 'string'
            ? manifest.main
            : './index.js'
      exportValue = main.startsWith('./') ? main : `./${main}`
    } else {
      exportValue = [subpath, `${subpath}.js`, `${subpath}.mjs`, `${subpath}/index.js`]
    }
  } else if (
    manifest.exports &&
    typeof manifest.exports === 'object' &&
    !Array.isArray(manifest.exports) &&
    Object.keys(manifest.exports).some((key) => key.startsWith('.'))
  ) {
    exportValue = (manifest.exports as Record<string, unknown>)[subpath]
  } else if (subpath === '.') {
    exportValue = manifest.exports
  }

  const targets = runtimeExportTargets(exportValue)
  for (const target of targets) {
    if (!target.startsWith('./') || target.includes('*')) continue
    const path = containedPath(packageRoot, target)
    if (!(await pathExists(path))) continue
    if ((await lstat(path)).isFile()) return
  }
  throw new Error(`Cordis entry ${plugin.entry} is not exported as a packed runtime file`)
}

async function validatePackedPackageIdentity(
  packageRoot: string,
  packageName: string,
  version: string,
): Promise<void> {
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as {
    name?: unknown
    version?: unknown
  }
  if (manifest.name !== packageName || manifest.version !== version) {
    throw new Error(`Packed package identity does not match ${packageName}@${version}`)
  }
}

async function verifiedToolCliPath(
  manifestSpecifier: string,
  packageName: string,
  version: string,
  expectedContentDigest: string,
  entry: string,
  runtimeDependencies: readonly LockedToolPackage[] = [],
): Promise<string> {
  const manifestPath = require.resolve(manifestSpecifier)
  await verifyInstalledToolPackage(
    manifestPath,
    packageName,
    version,
    expectedContentDigest,
  )
  await verifyToolRuntimeDependencies(manifestPath, runtimeDependencies, new Set())
  const packageRoot = dirname(manifestPath)
  const cliPath = containedPath(packageRoot, entry)
  if (!(await pathExists(cliPath)) || !(await lstat(cliPath)).isFile()) {
    throw new Error(`Installed ${packageName}@${version} has no executable ${entry}`)
  }
  return cliPath
}

async function verifyInstalledToolPackage(
  manifestPath: string,
  packageName: string,
  version: string,
  expectedContentDigest: string,
): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    name?: unknown
    version?: unknown
  }
  if (manifest.name !== packageName || manifest.version !== version) {
    throw new Error(
      `Expected ${packageName}@${version}, found ${String(manifest.name)}@${String(manifest.version)}`,
    )
  }
  const packageRoot = dirname(manifestPath)
  const actualContentDigest = await toolPackageContentDigest(packageRoot)
  if (actualContentDigest !== expectedContentDigest) {
    throw new Error(`Installed ${packageName}@${version} does not match its locked npm archive`)
  }
}

async function verifyToolRuntimeDependencies(
  parentManifestPath: string,
  dependencies: readonly LockedToolPackage[],
  verifiedManifestPaths: Set<string>,
): Promise<void> {
  const resolver = createRequire(parentManifestPath)
  for (const dependency of dependencies) {
    let manifestPath: string
    try {
      manifestPath = resolver.resolve(`${dependency.package}/package.json`)
    } catch {
      throw new Error(
        `Installed build tool is missing ${dependency.package}@${dependency.version}`,
      )
    }
    if (verifiedManifestPaths.has(manifestPath)) continue
    verifiedManifestPaths.add(manifestPath)
    await verifyInstalledToolPackage(
      manifestPath,
      dependency.package,
      dependency.version,
      dependency.contentDigest,
    )
    await verifyToolRuntimeDependencies(
      manifestPath,
      dependency.dependencies ?? [],
      verifiedManifestPaths,
    )
  }
}

async function skillsCliPath(): Promise<string> {
  return verifiedToolCliPath(
    'skills/package.json',
    SKILL_MANAGER.package,
    SKILL_MANAGER.version,
    SKILL_MANAGER.contentDigest,
    'bin/cli.mjs',
    SKILL_MANAGER_RUNTIME_DEPENDENCIES,
  )
}

async function pnpmCliPath(): Promise<string> {
  return verifiedToolCliPath(
    'pnpm',
    PACKAGE_MANAGER.package,
    PACKAGE_MANAGER.version,
    PACKAGE_MANAGER.contentDigest,
    'bin/pnpm.mjs',
  )
}

async function pnpmPackageRoot(): Promise<string> {
  const manifestPath = require.resolve('pnpm')
  await verifyInstalledToolPackage(
    manifestPath,
    PACKAGE_MANAGER.package,
    PACKAGE_MANAGER.version,
    PACKAGE_MANAGER.contentDigest,
  )
  return dirname(manifestPath)
}

async function copyBuildToolPackage(source: string, destination: string): Promise<void> {
  await cp(source, destination, {
    recursive: true,
    filter: (path) => {
      const child = relative(source, path)
      return child !== 'node_modules' && !child.startsWith(`node_modules${sep}`)
    },
  })
  await assertNoSourceSymlinks(destination)
  await normalizeTreeModes(destination)
}

const generatePnpmRuntimeLock: RuntimeLockGenerator = async ({
  environment,
  registryUrl,
  runtimeDirectory,
}) => {
  await runCommand(
    process.execPath,
    [
      await pnpmCliPath(),
      'install',
      '--lockfile-only',
      '--ignore-scripts',
      '--config.auto-install-peers=false',
      '--registry',
      registryUrl,
    ],
    {
      cwd: runtimeDirectory,
      env: {
        ...environment,
        CI: '1',
        COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
        NPM_CONFIG_AUDIT: 'false',
        NPM_CONFIG_FUND: 'false',
        NO_COLOR: '1',
      },
    },
  )
}

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Generated pnpm lock has invalid ${label}`)
  }
  return value as Record<string, unknown>
}

function validateRuntimeLock(
  source: string,
  directPackages: readonly RuntimeDirectPackage[],
): void {
  const lock = recordValue(parse(source), 'document')
  if (String(lock.lockfileVersion) !== '9.0') {
    throw new Error(`Generated pnpm lock uses unsupported version ${String(lock.lockfileVersion)}`)
  }
  const settings = recordValue(lock.settings, 'settings')
  if (settings.autoInstallPeers !== false) {
    throw new Error('Generated pnpm lock must disable automatic peer installation')
  }
  const importers = recordValue(lock.importers, 'importers')
  const runtimeImporter = recordValue(importers['.'], 'runtime importer')
  const dependencies = runtimeImporter.dependencies
    ? recordValue(runtimeImporter.dependencies, 'runtime dependencies')
    : {}
  const expectedPackages = [...new Set(directPackages.map((entry) => entry.package))].sort(
    compareText,
  )
  const actualPackages = Object.keys(dependencies).sort(compareText)
  if (canonicalJson(actualPackages) !== canonicalJson(expectedPackages)) {
    throw new Error('Generated pnpm lock does not contain exactly the runtime dependencies')
  }

  const packages = lock.packages ? recordValue(lock.packages, 'packages') : {}
  for (const [key, value] of Object.entries(packages)) {
    const packageEntry = recordValue(value, `package ${key}`)
    const resolution = recordValue(packageEntry.resolution, `resolution for ${key}`)
    if (
      typeof resolution.integrity !== 'string' ||
      !/^sha512-[A-Za-z0-9+/]{86}==$/.test(resolution.integrity)
    ) {
      throw new Error(`Generated pnpm lock lacks registry integrity for ${key}`)
    }
  }

  for (const directPackage of directPackages) {
    const importerEntry = recordValue(
      dependencies[directPackage.package],
      `dependency ${directPackage.package}`,
    )
    if (importerEntry.specifier !== directPackage.version) {
      throw new Error(
        `Generated pnpm lock changed ${directPackage.package} from ${directPackage.version}`,
      )
    }
    const key = `${directPackage.package}@${directPackage.version}`
    const packageEntry = recordValue(packages[key], `package ${key}`)
    const resolution = recordValue(packageEntry.resolution, `resolution for ${key}`)
    if (resolution.integrity !== directPackage.integrity) {
      throw new Error(`Generated pnpm lock integrity differs for ${key}`)
    }
  }
}

interface GeneratedPreset {
  baseDigest: `sha256:${string}`
  digest: `sha256:${string}`
  id: string
  composition: string
  metadata: string
  path: string
}

function generateStarPreset(
  standardPreset: string,
  employeeName: string,
  runtimeSkillRoot: string,
): GeneratedPreset {
  const skillRow =
    "- id: skill-filesystem\n  name: '@deepseek-ai/dsh-skill-filesystem'"
  if (standardPreset.split(skillRow).length !== 2) {
    throw new Error('Pinned DSH standard preset has an unexpected skill-filesystem row')
  }
  const composition = standardPreset.replace(
    skillRow,
    `${skillRow}\n  config:\n    providerName: filesystem\n    includeDefaultRoots: false\n    customSkillDirs:\n      - ${runtimeSkillRoot}\n    watch: false`,
  )
  const metadata = stringify({
    description: `Locked Star preset for ${employeeName}.`,
    name: `Star ${employeeName}`,
    order: 1,
  })
  const compositionBytes = Buffer.byteLength(composition)
  const metadataBytes = Buffer.byteLength(metadata)
  const digest = sha256(
    `star-preset-v1\0agent.cordis.yml\0${compositionBytes}\0${composition}\0preset.yml\0${metadataBytes}\0${metadata}`,
  )
  const id = `star-${digest.slice('sha256:'.length)}`
  return {
    baseDigest: sha256(standardPreset),
    composition,
    digest,
    id,
    metadata,
    path: `dsh/agent-presets/${id}`,
  }
}

export async function compileCapabilities(
  options: CompileCapabilitiesOptions,
): Promise<CompileCapabilitiesResult> {
  const validation = validateEmployeeRecipe(options.recipe)
  if (!validation.ok) {
    throw new Error(`Cannot compile an invalid Employee recipe: ${validation.issues[0]?.message}`)
  }
  if (
    options.recipe.spec.runtime.systemPackages.length > 0 ||
    options.recipe.spec.runtime.cliPackages.length > 0
  ) {
    throw new Error(
      'Runtime systemPackages and cliPackages are not supported by image compilation yet',
    )
  }
  const gitExecutable = options.gitExecutable ?? DEFAULT_GIT_EXECUTABLE
  if (!isAbsolute(gitExecutable)) {
    throw new Error(`Git executable must be an absolute path: ${gitExecutable}`)
  }

  const outputDirectory = resolve(options.outputDirectory)
  if (await pathExists(outputDirectory)) {
    throw new Error(`Output directory already exists: ${outputDirectory}`)
  }
  const resolvedOutputDirectory = await resolveFuturePath(outputDirectory)
  for (const skill of options.recipe.spec.skills ?? []) {
    if (skill.source.type !== 'local') continue
    const sourceRoot = resolve(dirname(resolve(options.recipePath)), skill.source.path)
    if (pathIsWithin(await realpath(sourceRoot), resolvedOutputDirectory)) {
      throw new Error(
        `Output directory cannot be inside local capability source: ${skill.source.path}`,
      )
    }
  }
  const outputParent = dirname(outputDirectory)
  await mkdir(outputParent, { recursive: true })

  const work = await mkdtemp(join(tmpdir(), 'star-capabilities-'))
  const artifact = await mkdtemp(join(outputParent, `.${basename(outputDirectory)}-`))
  let promoted = false
  try {
    const buildEnvironment = await isolatedBuildEnvironment(work)
    const fetcher = options.fetch ?? globalThis.fetch
    const registryUrl = options.registryUrl ?? 'https://registry.npmjs.org/'
    const allowedGitHosts = new Set(
      (options.allowedGitHosts ?? ['github.com']).map((host) => host.toLowerCase()),
    )
    const metadataCache = new Map<string, Promise<NpmMetadata>>()
    const packageCache = new Map<string, Promise<string>>()
    const gitCache = new Map<string, Promise<string>>()
    const localCache = new Map<string, Promise<string>>()
    const managerCwd = join(work, 'manager')
    const managerSkillRoot = join(managerCwd, '.agents', 'skills')
    await mkdir(managerSkillRoot, { recursive: true })

    const npmMetadata = (packageName: string, version: string) => {
      const key = `${packageName}@${version}`
      let pending = metadataCache.get(key)
      if (!pending) {
        pending = resolveNpmMetadata(packageName, version, registryUrl, fetcher)
        metadataCache.set(key, pending)
      }
      return pending
    }

    const materializeNpmPackage = async (packageName: string, version: string) => {
      const key = `${packageName}@${version}`
      const metadata = await npmMetadata(packageName, version)
      let pending = packageCache.get(key)
      if (!pending) {
        pending = extractNpmPackage(
          metadata,
          join(work, 'npm', String(packageCache.size)),
          fetcher,
        )
        packageCache.set(key, pending)
      }
      return { metadata, root: await pending }
    }

    const materializeSkill = async (skill: RecipeSkill): Promise<MaterializedSkillSource> => {
      const source = skill.source
      if (source.type === 'local') {
        const requestedRoot = resolve(dirname(resolve(options.recipePath)), source.path)
        let pending = localCache.get(requestedRoot)
        if (!pending) {
          pending = snapshotLocalSource(
            requestedRoot,
            join(work, 'local', String(localCache.size)),
          )
          localCache.set(requestedRoot, pending)
        }
        const root = await pending
        return {
          root,
          lockSource: {
            path: source.path,
            treeDigest: await treeDigest(root),
            type: 'local',
          },
        }
      }

      if (source.type === 'git') {
        const repositoryHost = new URL(source.repository).hostname.toLowerCase()
        if (!allowedGitHosts.has(repositoryHost)) {
          throw new Error(`Git host is not allowed by compiler policy: ${repositoryHost}`)
        }
        const key = `${source.repository}#${source.revision}`
        let pending = gitCache.get(key)
        if (!pending) {
          pending = materializeGitSource(
            source.repository,
            source.revision,
            join(work, 'git', String(gitCache.size)),
            buildEnvironment,
            gitExecutable,
          )
          gitCache.set(key, pending)
        }
        const checkout = await pending
        const root = containedPath(checkout, source.subpath)
        await assertNoSourceSymlinks(root)
        return {
          root,
          lockSource: {
            repository: source.repository,
            revision: source.revision,
            ...(source.subpath ? { subpath: source.subpath } : {}),
            treeDigest: await treeDigest(root),
            type: 'git',
          },
        }
      }

      const materializedPackage = await materializeNpmPackage(
        source.package,
        source.version,
      )
      const root = containedPath(materializedPackage.root, source.subpath)
      await assertNoSourceSymlinks(root)
      return {
        root,
        lockSource: {
          integrity: materializedPackage.metadata.integrity,
          package: source.package,
          ...(source.subpath ? { subpath: source.subpath } : {}),
          treeDigest: await treeDigest(root),
          type: 'npm',
          version: source.version,
        },
      }
    }

    const cliPath = await skillsCliPath()
    const lockedSkills: CapabilityLock['skills'] = []
    const skills = [...(options.recipe.spec.skills ?? [])].sort((left, right) =>
      compareText(left.name, right.name),
    )
    for (const skill of skills) {
      const materialized = await materializeSkill(skill)
      await runCommand(
        process.execPath,
        [
          cliPath,
          'add',
          materialized.root,
          '--agent',
          'universal',
          '--skill',
          skill.name,
          '--yes',
          '--copy',
        ],
        {
          cwd: managerCwd,
          env: {
            ...buildEnvironment,
            CI: '1',
            DISABLE_TELEMETRY: '1',
            DO_NOT_TRACK: '1',
            NO_COLOR: '1',
          },
        },
      )
      const installedRoot = join(managerSkillRoot, skill.name)
      if (!(await pathExists(installedRoot))) {
        throw new Error(`skills did not install the selected skill: ${skill.name}`)
      }
      await validateInstalledSkill(installedRoot, skill.name)
      await normalizeTreeModes(installedRoot)
      const artifactDigest = await treeDigest(installedRoot)
      lockedSkills.push({
        artifactDigest,
        name: skill.name,
        source: materialized.lockSource,
      })
    }

    const actualSkillNames = (await readdir(managerSkillRoot)).sort(compareText)
    const expectedSkillNames = skills.map((skill) => skill.name)
    if (canonicalJson(actualSkillNames) !== canonicalJson(expectedSkillNames)) {
      throw new Error(
        `skills produced an unexpected install set: ${actualSkillNames.join(', ') || '(empty)'}`,
      )
    }

    await chmod(managerSkillRoot, 0o755)
    const skillRootDigest = await treeDigest(managerSkillRoot)
    const skillRootPath = `skills/sha256-${skillRootDigest.slice('sha256:'.length)}`
    const compiledSkillRoot = join(artifact, skillRootPath)
    await mkdir(dirname(compiledSkillRoot), { recursive: true })
    await cp(managerSkillRoot, compiledSkillRoot, { recursive: true })
    if ((await treeDigest(compiledSkillRoot)) !== skillRootDigest) {
      throw new Error('Compiled skill root changed while being promoted')
    }

    const plugins = [...(options.recipe.spec.plugins ?? [])].sort((left, right) =>
      compareText(left.id, right.id),
    )
    const lockedPlugins: CapabilityLock['plugins'] = []
    const dependencyVersions = new Map<string, string>()
    for (const plugin of plugins) {
      const existingVersion = dependencyVersions.get(plugin.package)
      if (existingVersion && existingVersion !== plugin.version) {
        throw new Error(
          `Cordis package ${plugin.package} cannot use both ${existingVersion} and ${plugin.version}`,
        )
      }
      dependencyVersions.set(plugin.package, plugin.version)
      const materializedPackage = await materializeNpmPackage(
        plugin.package,
        plugin.version,
      )
      await validatePluginEntry(materializedPackage.root, plugin)
      lockedPlugins.push({
        entry: plugin.entry,
        id: plugin.id,
        integrity: materializedPackage.metadata.integrity,
        package: plugin.package,
        version: plugin.version,
      })
    }

    const profileDependencies = Object.fromEntries(
      [...dependencyVersions.entries()].sort(([left], [right]) => compareText(left, right)),
    )
    const runtimeSkillRoot = `/opt/star/${skillRootPath}`
    const harnessPackage = await materializeNpmPackage(
      options.recipe.spec.harness.package,
      options.recipe.spec.harness.version,
    )
    await validatePackedPackageIdentity(
      harnessPackage.root,
      options.recipe.spec.harness.package,
      options.recipe.spec.harness.version,
    )
    const standardPreset = await readFile(
      join(
        harnessPackage.root,
        'config',
        'agent-presets',
        'standard',
        'agent.cordis.yml',
      ),
      'utf8',
    )
    const preset = generateStarPreset(
      standardPreset,
      options.recipe.metadata.name,
      runtimeSkillRoot,
    )
    const presetDirectory = join(artifact, preset.path)
    await mkdir(presetDirectory, { recursive: true })
    await writeFile(join(presetDirectory, 'agent.cordis.yml'), preset.composition, 'utf8')
    await writeFile(join(presetDirectory, 'preset.yml'), preset.metadata, 'utf8')
    await chmod(presetDirectory, 0o755)
    await chmod(join(presetDirectory, 'agent.cordis.yml'), 0o644)
    await chmod(join(presetDirectory, 'preset.yml'), 0o644)

    const profileManifest = `${JSON.stringify(
      {
        name: `@star/employee-profile-${options.recipe.metadata.name}`,
        private: true,
        packageManager: `${PACKAGE_MANAGER.package}@${PACKAGE_MANAGER.version}`,
        dependencies: profileDependencies,
        dsh: {
          profile: {
            bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
          },
        },
      },
      null,
      2,
    )}\n`
    const profileReleaseAgeExclude = [...dependencyVersions.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([packageName, version]) => `${packageName}@${version}`)
    const profileWorkspace = stringify({
      packages: ['.'],
      nodeLinker: 'hoisted',
      autoInstallPeers: false,
      ...(profileReleaseAgeExclude.length > 0
        ? { minimumReleaseAgeExclude: profileReleaseAgeExclude }
        : {}),
    })
    const profilePatches: unknown[] = [
      {
        id: 'agent-presets',
        config: {
          default: preset.id,
          roots: [],
          includeUserRoot: true,
        },
      },
    ]
    if (lockedPlugins.length > 0) {
      profilePatches.push({
        insert: lockedPlugins.map((plugin) => ({
          id: `star-plugin-${plugin.id}`,
          name: plugin.entry,
        })),
      })
    }
    const profilePatch = stringify(profilePatches)
    const profileDirectory = join(artifact, 'dsh', 'profile')
    await mkdir(profileDirectory, { recursive: true })
    await writeFile(join(profileDirectory, 'package.json'), profileManifest, 'utf8')
    await writeFile(join(profileDirectory, 'cordis.patch.yml'), profilePatch, 'utf8')
    await writeFile(
      join(profileDirectory, 'pnpm-workspace.yaml'),
      profileWorkspace,
      'utf8',
    )

    const runtimeDependencyVersions = new Map(dependencyVersions)
    for (const [packageName, { version }] of Object.entries(DSH_RUNTIME_SUPPORT)) {
      const selectedVersion = runtimeDependencyVersions.get(packageName)
      if (selectedVersion !== undefined && selectedVersion !== version) {
        throw new Error(
          `Runtime package ${packageName} cannot use both ${selectedVersion} and ${version}`,
        )
      }
      runtimeDependencyVersions.set(packageName, version)
    }
    const selectedHarnessVersion = runtimeDependencyVersions.get(
      options.recipe.spec.harness.package,
    )
    if (
      selectedHarnessVersion !== undefined &&
      selectedHarnessVersion !== options.recipe.spec.harness.version
    ) {
      throw new Error(
        `Runtime package ${options.recipe.spec.harness.package} cannot use both ${selectedHarnessVersion} and ${options.recipe.spec.harness.version}`,
      )
    }
    runtimeDependencyVersions.set(
      options.recipe.spec.harness.package,
      options.recipe.spec.harness.version,
    )
    const runtimeDependencies = Object.fromEntries(
      [...runtimeDependencyVersions.entries()].sort(([left], [right]) =>
        compareText(left, right),
      ),
    )
    const runtimeManifest = `${JSON.stringify(
      {
        name: `@star/employee-runtime-${options.recipe.metadata.name}`,
        private: true,
        packageManager: `${PACKAGE_MANAGER.package}@${PACKAGE_MANAGER.version}`,
        dependencies: runtimeDependencies,
      },
      null,
      2,
    )}\n`
    const runtimeReleaseAgeExclude = [...runtimeDependencyVersions.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([packageName, version]) => `${packageName}@${version}`)
    const runtimeWorkspace = stringify({
      packages: ['.'],
      nodeLinker: 'hoisted',
      autoInstallPeers: false,
      minimumReleaseAgeExclude: runtimeReleaseAgeExclude,
    })
    const runtimeDirectory = join(artifact, 'dsh', 'runtime')
    await mkdir(runtimeDirectory, { recursive: true })
    await writeFile(join(runtimeDirectory, 'package.json'), runtimeManifest, 'utf8')
    await writeFile(
      join(runtimeDirectory, 'pnpm-workspace.yaml'),
      runtimeWorkspace,
      'utf8',
    )
    const runtimeDirectPackages: RuntimeDirectPackage[] = [
      {
        integrity: harnessPackage.metadata.integrity,
        package: options.recipe.spec.harness.package,
        version: options.recipe.spec.harness.version,
      },
      ...lockedPlugins,
      ...Object.entries(DSH_RUNTIME_SUPPORT).map(
        ([packageName, { integrity, version }]) => ({
          integrity,
          package: packageName,
          version,
        }),
      ),
    ]
    await (options.generateRuntimeLock ?? generatePnpmRuntimeLock)({
      directPackages: runtimeDirectPackages,
      environment: buildEnvironment,
      registryUrl,
      runtimeDirectory,
    })
    if ((await readFile(join(runtimeDirectory, 'package.json'), 'utf8')) !== runtimeManifest) {
      throw new Error('Runtime lock generation changed package.json')
    }
    const generatedWorkspace = await readFile(
      join(runtimeDirectory, 'pnpm-workspace.yaml'),
      'utf8',
    )
    if (generatedWorkspace !== runtimeWorkspace) {
      throw new Error(
        `Runtime lock generation changed pnpm-workspace.yaml:\n${generatedWorkspace}`,
      )
    }
    const runtimeLock = await readFile(join(runtimeDirectory, 'pnpm-lock.yaml'), 'utf8')
    validateRuntimeLock(runtimeLock, runtimeDirectPackages)

    const packageManagerArtifact = join(artifact, 'dsh', 'build-tools', 'pnpm')
    await mkdir(dirname(packageManagerArtifact), { recursive: true })
    await copyBuildToolPackage(await pnpmPackageRoot(), packageManagerArtifact)
    if (
      (await toolPackageContentDigest(packageManagerArtifact)) !==
      PACKAGE_MANAGER.contentDigest
    ) {
      throw new Error('Copied pnpm build artifact differs from its locked npm archive')
    }

    const entrypoint = runtimeEntrypointSource()
    const dockerfile = dockerfileSource(options.recipe.spec.runtime.baseImage)
    const imageDirectory = join(artifact, 'image')
    await mkdir(imageDirectory, { recursive: true })
    await writeFile(join(imageDirectory, 'entrypoint.mjs'), entrypoint, 'utf8')
    await writeFile(join(imageDirectory, 'Dockerfile'), dockerfile, 'utf8')

    const lock: CapabilityLock = {
      apiVersion: 'star.employee.capabilities/v1alpha1',
      harness: {
        integrity: harnessPackage.metadata.integrity,
        package: options.recipe.spec.harness.package,
        profile: options.recipe.spec.harness.profile,
        version: options.recipe.spec.harness.version,
      },
      image: {
        base: options.recipe.spec.runtime.baseImage,
        dockerfileDigest: sha256(dockerfile),
        entrypointDigest: sha256(entrypoint),
      },
      recipe: {
        apiVersion: options.recipe.apiVersion,
        digest: sha256(canonicalJson(options.recipe)),
        name: options.recipe.metadata.name,
      },
      tools: {
        skillManager: SKILL_MANAGER,
        packageManager: PACKAGE_MANAGER,
      },
      skills: lockedSkills,
      skillRoot: {
        digest: skillRootDigest,
        path: skillRootPath,
        runtimePath: runtimeSkillRoot,
      },
      plugins: lockedPlugins,
      preset: {
        base: 'standard',
        baseDigest: preset.baseDigest,
        digest: preset.digest,
        id: preset.id,
        path: preset.path,
      },
      profile: {
        packageManifestDigest: sha256(profileManifest),
        patchDigest: sha256(profilePatch),
        workspaceDigest: sha256(profileWorkspace),
      },
      runtime: {
        lockfileDigest: sha256(runtimeLock),
        packageManifestDigest: sha256(runtimeManifest),
        workspaceDigest: sha256(runtimeWorkspace),
      },
    }
    await writeFile(
      join(artifact, 'capabilities.lock.json'),
      `${JSON.stringify(lock, null, 2)}\n`,
      'utf8',
    )

    await rename(artifact, outputDirectory)
    promoted = true
    return { lock, outputDirectory }
  } catch (error) {
    throw new Error(`Capability compilation failed: ${errorMessage(error)}`, { cause: error })
  } finally {
    await rm(work, { force: true, recursive: true })
    if (!promoted) await rm(artifact, { force: true, recursive: true })
  }
}
