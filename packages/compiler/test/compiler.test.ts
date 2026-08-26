import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { EmployeeRecipe } from '@star/employee-contracts'
import * as tar from 'tar'
import { parse, stringify } from 'yaml'
import { afterEach, describe, expect, it } from 'vitest'
import {
  compileCapabilities as compileCapabilitiesRaw,
  type RuntimeLockGenerator,
} from '../src/index.js'

// The compiler reads the compiled bridge plugin from the built package at
// production compile time; tests inject a deterministic fixture so they stay
// independent of build order.
const BRIDGE_FIXTURE = '// star-supervisor-bridge fixture\n'
const compileCapabilities: typeof compileCapabilitiesRaw = (options) =>
  compileCapabilitiesRaw({ ...options, bridgePluginSource: BRIDGE_FIXTURE })

const temporaryDirectories: string[] = []
const execFileAsync = promisify(execFile)

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  )
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'star-compiler-test-'))
  temporaryDirectories.push(directory)
  return directory
}

function recipe(
  skills: NonNullable<EmployeeRecipe['spec']['skills']> = [],
  plugins: NonNullable<EmployeeRecipe['spec']['plugins']> = [],
): EmployeeRecipe {
  return {
    apiVersion: 'star.employee/v1alpha1',
    kind: 'Employee',
    metadata: { name: 'compiler-test' },
    spec: {
      execution: {
        defaultProfile: 'light',
        profiles: { light: { provider: 'local' } },
      },
      harness: {
        package: '@deepseek-ai/dsh',
        profile: 'employee-web',
        version: '0.1.1-rc.2',
      },
      identity: {
        serviceAccount: 'compiler-test',
        supervisorGroup: 'platform',
      },
      memory: { retentionDays: 30, volumeSize: '1Gi' },
      model: {
        default: 'deepseek/deepseek-chat',
        gatewayRef: 'model-gateway',
      },
      observability: { audit: 'required', contentCapture: false },
      plugins,
      runtime: {
        baseImage:
          'docker.io/library/node:24-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03',
        cliPackages: [],
        controlPod: { cpu: '1', memory: '1Gi' },
        systemPackages: [],
      },
      skills,
      tools: { allow: [], defaultPolicy: 'read-only', requireApproval: [] },
    },
  }
}

async function writeSkill(root: string, name: string): Promise<void> {
  const directory = join(root, 'skills', name)
  await mkdir(join(directory, 'scripts'), { recursive: true })
  await writeFile(
    join(directory, 'SKILL.md'),
    `---\nname: ${name}\ndescription: Reports deterministic fixture data.\n---\n\n# ${name}\n`,
    'utf8',
  )
  await writeFile(join(directory, 'scripts', 'main.mjs'), 'process.stdout.write("ok\\n")\n')
}

function responseWithUrl(
  body: BodyInit | Buffer,
  url: string,
  init?: ResponseInit,
): Response {
  const response = new Response(Buffer.isBuffer(body) ? Uint8Array.from(body) : body, init)
  Object.defineProperty(response, 'url', { value: url })
  return response
}

interface RegistryFixture {
  archive: Buffer
  integrity: string
  name: string
  tarballUrl: string
  version: string
}

async function packageFixture(
  root: string,
  key: string,
  name: string,
  version: string,
  files: Record<string, string>,
  manifest: Record<string, unknown> = {},
): Promise<RegistryFixture> {
  const archiveSource = join(root, `${key}-archive`)
  const packageRoot = join(archiveSource, 'package')
  const archivePath = join(root, `${key}.tgz`)
  for (const [path, source] of Object.entries(files)) {
    const target = join(packageRoot, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, source, 'utf8')
  }
  await writeFile(
    join(packageRoot, 'package.json'),
    `${JSON.stringify({ ...manifest, name, version })}\n`,
    'utf8',
  )
  await tar.c({ cwd: archiveSource, file: archivePath, gzip: true }, ['package'])
  const archive = await readFile(archivePath)
  return {
    archive,
    integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
    name,
    tarballUrl: `https://registry.example/${key}.tgz`,
    version,
  }
}

async function dshFixture(root: string): Promise<RegistryFixture> {
  return packageFixture(
    root,
    'dsh',
    '@deepseek-ai/dsh',
    '0.1.1-rc.2',
    {
      'config/agent-presets/standard/agent.cordis.yml': [
        '- id: persona',
        "  name: '@deepseek-ai/dsh-persona'",
        '',
        '- id: skill-filesystem',
        "  name: '@deepseek-ai/dsh-skill-filesystem'",
        '',
        '- id: tool-skill',
        "  name: '@deepseek-ai/dsh-tool-skill'",
        '',
      ].join('\n'),
    },
  )
}

function registryFetch(fixtures: RegistryFixture[]): typeof fetch {
  return (async (input) => {
    const url = String(input)
    const tarball = fixtures.find((fixture) => fixture.tarballUrl === url)
    if (tarball) {
      return responseWithUrl(tarball.archive, url, {
        headers: { 'content-length': String(tarball.archive.byteLength) },
        status: 200,
      })
    }
    const metadata = fixtures.find((fixture) =>
      url.endsWith(
        `${encodeURIComponent(fixture.name)}/${encodeURIComponent(fixture.version)}`,
      ),
    )
    if (!metadata) throw new Error(`Unexpected registry request: ${url}`)
    return responseWithUrl(
      JSON.stringify({
        dist: { integrity: metadata.integrity, tarball: metadata.tarballUrl },
        name: metadata.name,
        version: metadata.version,
      }),
      url,
      { headers: { 'content-type': 'application/json' }, status: 200 },
    )
  }) as typeof fetch
}

function fixtureRuntimeLock(
  integrities: Record<string, string>,
  autoInstallPeers = false,
): RuntimeLockGenerator {
  return async ({ directPackages, runtimeDirectory }) => {
    const manifest = JSON.parse(
      await readFile(join(runtimeDirectory, 'package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> }
    const directPackageIntegrities = new Map(
      directPackages.map((entry) => [entry.package, entry.integrity]),
    )
    for (const [name, integrity] of Object.entries(integrities)) {
      if (directPackageIntegrities.get(name) !== integrity) {
        throw new Error(`Unexpected direct integrity for ${name}`)
      }
    }
    const dependencies = Object.fromEntries(
      Object.entries(manifest.dependencies).map(([name, version]) => [
        name,
        { specifier: version, version },
      ]),
    )
    const packages = Object.fromEntries(
      Object.entries(manifest.dependencies).map(([name, version]) => [
        `${name}@${version}`,
        {
          resolution: {
            integrity: directPackageIntegrities.get(name),
          },
        },
      ]),
    )
    await writeFile(
      join(runtimeDirectory, 'pnpm-lock.yaml'),
      stringify({
        importers: { '.': { dependencies } },
        lockfileVersion: '9.0',
        packages,
        settings: { autoInstallPeers },
      }),
      'utf8',
    )
  }
}

describe('capability compiler', () => {
  it('rejects runtime packages until their exact image contract is implemented', async () => {
    const employee = recipe()
    employee.spec.runtime.systemPackages = [{ name: 'git' }]

    await expect(
      compileCapabilities({
        outputDirectory: join(await temporaryDirectory(), 'output'),
        recipe: employee,
        recipePath: 'employee.yaml',
      }),
    ).rejects.toThrow(
      'Runtime systemPackages and cliPackages are not supported by image compilation yet',
    )
  })

  it('uses the pinned skills CLI and produces a reproducible local skill root', async () => {
    const root = await temporaryDirectory()
    const source = join(root, 'capability')
    const recipePath = join(root, 'employee.yaml')
    await writeSkill(source, 'env-report')
    await writeFile(recipePath, 'fixture\n', 'utf8')
    const dsh = await dshFixture(root)
    const fetcher = registryFetch([dsh])
    const generateRuntimeLock = fixtureRuntimeLock({
      '@deepseek-ai/dsh': dsh.integrity,
    })
    const employee = recipe([
      { name: 'env-report', source: { path: 'capability', type: 'local' } },
    ])

    const first = await compileCapabilities({
      fetch: fetcher,
      generateRuntimeLock,
      outputDirectory: join(root, 'first'),
      recipe: employee,
      recipePath,
      registryUrl: 'https://registry.example/',
    })
    const second = await compileCapabilities({
      fetch: fetcher,
      generateRuntimeLock,
      outputDirectory: join(root, 'second'),
      recipe: employee,
      recipePath,
      registryUrl: 'https://registry.example/',
    })

    expect(second.lock).toEqual(first.lock)
    expect(first.lock.tools.skillManager).toEqual({
      contentDigest:
        'sha256:9bb08d2fa5128acb9914ef5f719fb9f759229fc64da639a2bf6f5a8da42882dd',
      integrity:
        'sha512-+hMNBSi35yfX0sKD+ZcRm9y5or7u313OdkcvrRvJAsAzGCaA8wRTu2OmVdN0KRbk9ybqKby5dijkn6OVvNTUmw==',
      package: 'skills',
      version: '1.5.23',
    })
    expect(first.lock.skills[0]?.source.treeDigest).not.toBe(
      first.lock.skills[0]?.artifactDigest,
    )
    const installedSkill = join(
      first.outputDirectory,
      first.lock.skillRoot.path,
      'env-report',
      'SKILL.md',
    )
    expect(await readFile(installedSkill, 'utf8')).toContain('name: env-report')
    expect((await stat(installedSkill)).mode & 0o777).toBe(0o644)
    const profilePatch = await readFile(
      join(first.outputDirectory, 'dsh/profile/cordis.patch.yml'),
      'utf8',
    )
    expect(profilePatch).toContain(`default: ${first.lock.preset.id}`)
    expect(profilePatch).toContain('id: supervisor-bridge')
    expect(profilePatch).toContain('name: /opt/star/bridge/plugin.mjs')
    expect(profilePatch).toContain(`presetId: ${first.lock.preset.id}`)
    expect(
      await readFile(join(first.outputDirectory, 'bridge/plugin.mjs'), 'utf8'),
    ).toBe(BRIDGE_FIXTURE)
    expect(first.lock.bridge).toEqual({
      artifactDigest: `sha256:${createHash('sha256').update(BRIDGE_FIXTURE).digest('hex')}`,
      path: 'bridge/plugin.mjs',
      runtimePath: '/opt/star/bridge/plugin.mjs',
    })
    expect(
      await readFile(
        join(first.outputDirectory, first.lock.preset.path, 'agent.cordis.yml'),
        'utf8',
      ),
    ).toContain(
      `includeDefaultRoots: false\n    customSkillDirs:\n      - ${first.lock.skillRoot.runtimePath}\n    watch: false`,
    )
    const runtimeLock = parse(
      await readFile(join(first.outputDirectory, 'dsh/runtime/pnpm-lock.yaml'), 'utf8'),
    ) as { lockfileVersion: string }
    expect(runtimeLock.lockfileVersion).toBe('9.0')
    const runtimeManifest = JSON.parse(
      await readFile(join(first.outputDirectory, 'dsh/runtime/package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> }
    expect(runtimeManifest.dependencies).toMatchObject({
      '@deepseek-ai/cordis-plugin-group': '1.0.1',
      '@deepseek-ai/dsh': '0.1.1-rc.2',
      '@deepseek-ai/dsh-invariants': '0.1.1-rc.2',
      '@deepseek-ai/dsh-workflow': '0.1.1-rc.2',
      react: '18.3.1',
      'react-dom': '18.3.1',
    })
    expect(Object.keys(runtimeManifest.dependencies)).toHaveLength(22)
    const dockerfile = await readFile(
      join(first.outputDirectory, 'image/Dockerfile'),
      'utf8',
    )
    expect(dockerfile).toContain(`FROM ${employee.spec.runtime.baseImage}`)
    expect(dockerfile).toContain('USER node')
    expect(dockerfile).toContain('rm -f /usr/local/bin/npm')

    const fakeDshRoot = join(
      first.outputDirectory,
      'dsh/runtime/node_modules/@deepseek-ai/dsh',
    )
    await mkdir(join(fakeDshRoot, 'lib'), { recursive: true })
    await writeFile(
      join(fakeDshRoot, 'package.json'),
      `${JSON.stringify({ name: '@deepseek-ai/dsh', version: '0.1.1-rc.2' })}\n`,
      'utf8',
    )
    await writeFile(join(fakeDshRoot, 'lib/bin.js'), '', 'utf8')
    const dshHome = join(root, 'dsh-home')
    const activationEnvironment = {
      ...process.env,
      DSH_HOME: dshHome,
      STAR_RUNTIME_ROOT: first.outputDirectory,
    }
    const entrypoint = join(first.outputDirectory, 'image/entrypoint.mjs')
    const activated = await execFileAsync(process.execPath, [entrypoint, '--activate-only'], {
      env: activationEnvironment,
    })
    expect(JSON.parse(activated.stdout)).toEqual({
      preset: first.lock.preset.id,
      profile: employee.spec.harness.profile,
    })
    const activatedProfile = join(dshHome, 'profiles', employee.spec.harness.profile)
    const witness = join(dshHome, 'sessions', 'witness')
    await mkdir(dirname(witness), { recursive: true })
    await writeFile(witness, 'preserved\n', 'utf8')
    await chmod(join(activatedProfile, 'cordis.patch.yml'), 0o644)
    await writeFile(join(activatedProfile, 'cordis.patch.yml'), 'drifted\n', 'utf8')
    await execFileAsync(process.execPath, [entrypoint, '--activate-only'], {
      env: activationEnvironment,
    })
    expect(await readFile(witness, 'utf8')).toBe('preserved\n')
    expect(await readFile(join(activatedProfile, 'cordis.patch.yml'), 'utf8')).toBe(
      profilePatch.replaceAll(
        '/opt/star/bridge/plugin.mjs',
        join(first.outputDirectory, 'bridge/plugin.mjs'),
      ),
    )
    expect(await readlink(join(activatedProfile, 'node_modules'))).toBe(
      join(first.outputDirectory, 'dsh/runtime/node_modules'),
    )
    const activatedPresetComposition = join(
      dshHome,
      '.agent-presets',
      first.lock.preset.id,
      'agent.cordis.yml',
    )
    expect(await readFile(activatedPresetComposition, 'utf8')).toContain(
      join(first.outputDirectory, first.lock.skillRoot.path),
    )
    expect((await stat(activatedPresetComposition)).mode & 0o777).toBe(0o644)

    const outsideProfile = join(root, 'outside-profile')
    await rm(activatedProfile, { force: true, recursive: true })
    await mkdir(outsideProfile)
    await symlink(outsideProfile, activatedProfile, 'dir')
    await expect(
      execFileAsync(process.execPath, [entrypoint, '--activate-only'], {
        env: activationEnvironment,
      }),
    ).rejects.toThrow('managed path must be a directory')
    await expect(readFile(join(outsideProfile, 'package.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
  }, 30_000)

  it('locks an exact Cordis package and emits its explicit profile entry', async () => {
    const root = await temporaryDirectory()
    const dsh = await dshFixture(root)
    const cordis = await packageFixture(
      root,
      'fixture-cordis',
      'fixture-cordis',
      '1.2.3',
      { 'dist/deepseek.js': 'export function apply() {}\n' },
      { exports: { './deepseek': './dist/deepseek.js' } },
    )
    const fetcher = registryFetch([dsh, cordis])
    const generatedFixtureLock = fixtureRuntimeLock({
      '@deepseek-ai/dsh': dsh.integrity,
      'fixture-cordis': cordis.integrity,
    })
    let runtimeEnvironment: NodeJS.ProcessEnv | undefined
    const generateRuntimeLock: RuntimeLockGenerator = async (options) => {
      runtimeEnvironment = options.environment
      await generatedFixtureLock(options)
    }
    const ambientSecretName = 'STAR_COMPILER_TEST_AMBIENT_SECRET'
    const previousAmbientSecret = process.env[ambientSecretName]
    process.env[ambientSecretName] = 'must-not-reach-build-tools'

    const result = await (async () => {
      try {
        return await compileCapabilities({
          fetch: fetcher,
          generateRuntimeLock,
          outputDirectory: join(root, 'output'),
          recipe: recipe([], [
            {
              entry: 'fixture-cordis/deepseek',
              id: 'fixture-cordis',
              package: 'fixture-cordis',
              version: '1.2.3',
            },
          ]),
          recipePath: join(root, 'employee.yaml'),
          registryUrl: 'https://registry.example/',
        })
      } finally {
        if (previousAmbientSecret === undefined) {
          delete process.env[ambientSecretName]
        } else {
          process.env[ambientSecretName] = previousAmbientSecret
        }
      }
    })()

    expect(result.lock.plugins).toEqual([
      {
        entry: 'fixture-cordis/deepseek',
        id: 'fixture-cordis',
        integrity: cordis.integrity,
        package: 'fixture-cordis',
        version: '1.2.3',
      },
    ])
    expect(await readFile(join(result.outputDirectory, 'dsh/profile/package.json'), 'utf8')).toContain(
      '"fixture-cordis": "1.2.3"',
    )
    expect(
      await readFile(join(result.outputDirectory, 'dsh/profile/cordis.patch.yml'), 'utf8'),
    ).toContain('id: star-plugin-fixture-cordis\n      name: fixture-cordis/deepseek')
    expect(
      await readFile(join(result.outputDirectory, 'dsh/profile/pnpm-workspace.yaml'), 'utf8'),
    ).toContain('minimumReleaseAgeExclude:\n  - fixture-cordis@1.2.3')
    expect(runtimeEnvironment).not.toHaveProperty(ambientSecretName)
    expect(runtimeEnvironment?.HOME).not.toBe(process.env.HOME)

    await expect(
      compileCapabilities({
        fetch: fetcher,
        generateRuntimeLock: fixtureRuntimeLock(
          {
            '@deepseek-ai/dsh': dsh.integrity,
            'fixture-cordis': cordis.integrity,
          },
          true,
        ),
        outputDirectory: join(root, 'automatic-peers'),
        recipe: recipe([], [
          {
            entry: 'fixture-cordis/deepseek',
            id: 'fixture-cordis',
            package: 'fixture-cordis',
            version: '1.2.3',
          },
        ]),
        recipePath: join(root, 'employee.yaml'),
        registryUrl: 'https://registry.example/',
      }),
    ).rejects.toThrow('must disable automatic peer installation')

    await expect(
      compileCapabilities({
        fetch: fetcher,
        generateRuntimeLock: async (options) => {
          await generatedFixtureLock(options)
          const lockPath = join(options.runtimeDirectory, 'pnpm-lock.yaml')
          const lock = parse(await readFile(lockPath, 'utf8')) as {
            packages: Record<string, { resolution: { integrity: string } }>
          }
          lock.packages['react@18.3.1']!.resolution.integrity =
            `sha512-${Buffer.alloc(64).toString('base64')}`
          await writeFile(lockPath, stringify(lock), 'utf8')
        },
        outputDirectory: join(root, 'changed-support-integrity'),
        recipe: recipe([], [
          {
            entry: 'fixture-cordis/deepseek',
            id: 'fixture-cordis',
            package: 'fixture-cordis',
            version: '1.2.3',
          },
        ]),
        recipePath: join(root, 'employee.yaml'),
        registryUrl: 'https://registry.example/',
      }),
    ).rejects.toThrow('integrity differs for react@18.3.1')

    await expect(
      compileCapabilities({
        fetch: fetcher,
        generateRuntimeLock,
        outputDirectory: join(root, 'missing-entry'),
        recipe: recipe([], [
          {
            entry: 'fixture-cordis/missing',
            id: 'fixture-cordis',
            package: 'fixture-cordis',
            version: '1.2.3',
          },
        ]),
        recipePath: join(root, 'employee.yaml'),
        registryUrl: 'https://registry.example/',
      }),
    ).rejects.toThrow('is not exported as a packed runtime file')
  })

  it('verifies and extracts an npm skill tarball before invoking the manager', async () => {
    const root = await temporaryDirectory()
    const dsh = await dshFixture(root)
    const skillPackage = await packageFixture(
      root,
      'fixture-skills',
      'fixture-skills',
      '1.2.3',
      {
        'skills/env-report/SKILL.md':
          '---\nname: env-report\ndescription: Reports deterministic fixture data.\n---\n',
        'skills/env-report/scripts/main.mjs': 'process.stdout.write("ok\\n")\n',
      },
    )
    const fetcher = registryFetch([dsh, skillPackage])
    const generateRuntimeLock = fixtureRuntimeLock({
      '@deepseek-ai/dsh': dsh.integrity,
    })

    const result = await compileCapabilities({
      fetch: fetcher,
      generateRuntimeLock,
      outputDirectory: join(root, 'output'),
      recipe: recipe([
        {
          name: 'env-report',
          source: { package: 'fixture-skills', type: 'npm', version: '1.2.3' },
        },
      ]),
      recipePath: join(root, 'employee.yaml'),
      registryUrl: 'https://registry.example/',
    })

    expect(result.lock.skills[0]?.source).toEqual(
      expect.objectContaining({
        integrity: skillPackage.integrity,
        package: 'fixture-skills',
        type: 'npm',
        version: '1.2.3',
      }),
    )
  }, 30_000)

  it('rejects source symlinks before the skill manager can dereference them', async () => {
    const root = await temporaryDirectory()
    const source = join(root, 'capability')
    await writeSkill(source, 'env-report')
    await symlink('/etc', join(source, 'node_modules'))

    await expect(
      compileCapabilities({
        outputDirectory: join(root, 'output'),
        recipe: recipe([
          { name: 'env-report', source: { path: 'capability', type: 'local' } },
        ]),
        recipePath: join(root, 'employee.yaml'),
      }),
    ).rejects.toThrow('Capability source contains a symlink')
  })

  it('rejects output directories contained by a local capability source', async () => {
    const root = await temporaryDirectory()
    await writeSkill(root, 'env-report')

    await expect(
      compileCapabilities({
        outputDirectory: join(root, 'compiled'),
        recipe: recipe([
          { name: 'env-report', source: { path: '.', type: 'local' } },
        ]),
        recipePath: join(root, 'employee.yaml'),
      }),
    ).rejects.toThrow('Output directory cannot be inside local capability source')
  })

  it('rejects an output-parent symlink into a local capability source', async () => {
    const root = await temporaryDirectory()
    const source = join(root, 'capability')
    await writeSkill(source, 'env-report')
    await symlink(source, join(root, 'output-link'))

    await expect(
      compileCapabilities({
        outputDirectory: join(root, 'output-link', 'compiled'),
        recipe: recipe([
          { name: 'env-report', source: { path: 'capability', type: 'local' } },
        ]),
        recipePath: join(root, 'employee.yaml'),
      }),
    ).rejects.toThrow('Output directory cannot be inside local capability source')
  })

  it('compiles an exact Git source through an absolute isolated executable', async () => {
    const root = await temporaryDirectory()
    const revision = '77484b8933bd556f41f07f733c5644ab1ff2cbc1'
    const repository = 'https://github.com/example/capability.git'
    const gitExecutable = join(root, 'git-fixture.mjs')
    await writeFile(
      gitExecutable,
      `#!${process.execPath}
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
if (process.env.STAR_COMPILER_TEST_AMBIENT_SECRET) process.exit(10)
if (args[0] === 'remote' && args.at(-1) !== ${JSON.stringify(repository)}) process.exit(11)
if (args.includes('fetch') && args.at(-1) !== ${JSON.stringify(revision)}) process.exit(12)
if (args.includes('checkout')) {
  const skill = join(process.cwd(), 'nested', 'skills', 'env-report')
  mkdirSync(skill, { recursive: true })
  writeFileSync(join(skill, 'SKILL.md'), '---\\nname: env-report\\ndescription: Reports fixture Git data.\\n---\\n')
}
if (args[0] === 'rev-parse') process.stdout.write(${JSON.stringify(`${revision}\n`)})
`,
      'utf8',
    )
    await chmod(gitExecutable, 0o755)
    const dsh = await dshFixture(root)
    const generateRuntimeLock = fixtureRuntimeLock({
      '@deepseek-ai/dsh': dsh.integrity,
    })
    const ambientSecretName = 'STAR_COMPILER_TEST_AMBIENT_SECRET'
    const previousAmbientSecret = process.env[ambientSecretName]
    process.env[ambientSecretName] = 'must-not-reach-git'

    const result = await (async () => {
      try {
        return await compileCapabilities({
          fetch: registryFetch([dsh]),
          generateRuntimeLock,
          gitExecutable,
          outputDirectory: join(root, 'output'),
          recipe: recipe([
            {
              name: 'env-report',
              source: {
                repository,
                revision,
                subpath: 'nested',
                type: 'git',
              },
            },
          ]),
          recipePath: join(root, 'employee.yaml'),
          registryUrl: 'https://registry.example/',
        })
      } finally {
        if (previousAmbientSecret === undefined) {
          delete process.env[ambientSecretName]
        } else {
          process.env[ambientSecretName] = previousAmbientSecret
        }
      }
    })()

    expect(result.lock.skills[0]?.source).toEqual(
      expect.objectContaining({ repository, revision, subpath: 'nested', type: 'git' }),
    )
    expect(
      await readFile(
        join(result.outputDirectory, result.lock.skillRoot.path, 'env-report', 'SKILL.md'),
        'utf8',
      ),
    ).toContain('Reports fixture Git data')
  }, 30_000)

  it('rejects Git hosts outside the compiler egress policy', async () => {
    const root = await temporaryDirectory()

    await expect(
      compileCapabilities({
        outputDirectory: join(root, 'compiled'),
        recipe: recipe([
          {
            name: 'env-report',
            source: {
              repository: 'https://127.0.0.1/internal.git',
              revision: 'a'.repeat(40),
              type: 'git',
            },
          },
        ]),
        recipePath: join(root, 'employee.yaml'),
      }),
    ).rejects.toThrow('Git host is not allowed by compiler policy')
  })
})
