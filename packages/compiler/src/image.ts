export function dockerfileSource(baseImage: string): string {
  return `FROM ${baseImage} AS star-dependencies

USER root
WORKDIR /opt/star/dsh/runtime
COPY dsh/runtime/package.json dsh/runtime/pnpm-lock.yaml dsh/runtime/pnpm-workspace.yaml ./
COPY dsh/build-tools/pnpm /opt/star/build-tools/pnpm
RUN node /opt/star/build-tools/pnpm/bin/pnpm.mjs install \\
      --prod \\
      --frozen-lockfile \\
      --ignore-scripts \\
      --config.auto-install-peers=false

FROM ${baseImage}

USER root
ENV DSH_HOME=/var/lib/star/dsh \\
    DSH_TELEMETRY_DISABLED=1 \\
    HOME=/home/node \\
    NODE_ENV=production
WORKDIR /workspace

COPY --from=star-dependencies /opt/star/dsh/runtime /opt/star/dsh/runtime
COPY capabilities.lock.json /opt/star/capabilities.lock.json
COPY dsh/profile /opt/star/dsh/profile
COPY dsh/agent-presets /opt/star/dsh/agent-presets
COPY skills /opt/star/skills
COPY bridge /opt/star/bridge
COPY image/Dockerfile /opt/star/image/Dockerfile
COPY image/entrypoint.mjs /opt/star/image/entrypoint.mjs

RUN set -eux; \\
    rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack; \\
    rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg; \\
    rm -f /usr/bin/git /usr/bin/git-*; \\
    rm -rf /usr/lib/git-core; \\
    rm -f /usr/bin/apt* /usr/bin/dpkg* /usr/sbin/update-alternatives; \\
    rm -rf /var/lib/apt/lists/* /var/cache/apt/*; \\
    mkdir -p /var/lib/star/dsh /workspace; \\
    chown node:node /var/lib/star/dsh /workspace; \\
    find /opt/star -type d -exec chmod 0555 {} +; \\
    find /opt/star -type f -exec chmod 0444 {} +

USER node
EXPOSE 3080
STOPSIGNAL SIGTERM
ENTRYPOINT ["node", "/opt/star/image/entrypoint.mjs"]
CMD ["--no-open"]
`
}

export function runtimeEntrypointSource(): string {
  return `import { createHash } from 'node:crypto'
import { chmod, cp, lstat, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function fail(message) {
  throw new Error(\`Star runtime activation failed: \${message}\`)
}

function sha256(value) {
  return \`sha256:\${createHash('sha256').update(value).digest('hex')}\`
}

async function verifyFile(path, expectedDigest) {
  const contents = await readFile(path)
  if (sha256(contents) !== expectedDigest) fail(\`immutable file digest differs: \${path}\`)
  return contents
}

async function treeDigest(root) {
  const hash = createHash('sha256').update('star-tree-v1\\0')
  async function visit(directory, prefix) {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )
    for (const entry of entries) {
      const path = join(directory, entry.name)
      const relativePath = prefix ? \`\${prefix}/\${entry.name}\` : entry.name
      const fileStat = await lstat(path)
      if (fileStat.isSymbolicLink()) fail(\`immutable tree contains a symlink: \${relativePath}\`)
      if (fileStat.isDirectory()) {
        hash.update(\`d\\0\${relativePath}\\0\`)
        await visit(path, relativePath)
      } else if (fileStat.isFile()) {
        const mode = fileStat.mode & 0o111 ? '755' : '644'
        const contents = await readFile(path)
        hash.update(\`f\\0\${relativePath}\\0\${mode}\\0\${contents.byteLength}\\0\`)
        hash.update(contents)
        hash.update('\\0')
      } else {
        fail(\`immutable tree contains a special file: \${relativePath}\`)
      }
    }
  }
  await visit(root, '')
  return \`sha256:\${hash.digest('hex')}\`
}

async function writeManagedFile(source, target, expectedDigest) {
  await writeManagedContents(target, await verifyFile(source, expectedDigest))
}

async function writeManagedContents(target, contents) {
  await mkdir(dirname(target), { recursive: true })
  const temporary = \`\${target}.star-\${process.pid}\`
  await rm(temporary, { force: true })
  await writeFile(temporary, contents, { mode: 0o444 })
  await rename(temporary, target)
  await chmod(target, 0o444)
}

async function makeManagedTreeWritable(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      await makeManagedTreeWritable(path)
    } else if (entry.isFile()) {
      await chmod(path, 0o644)
    } else {
      fail(\`managed preset contains unsupported entry: \${relative(root, path)}\`)
    }
  }
  await chmod(root, 0o755)
}

async function ensureManagedDirectory(path) {
  await mkdir(path, { recursive: true })
  const pathStat = await lstat(path)
  if (!pathStat.isDirectory() || pathStat.isSymbolicLink()) {
    fail(\`managed path must be a directory, not a symlink or special file: \${path}\`)
  }
}

async function activate() {
  const immutableValue = process.env.STAR_RUNTIME_ROOT ?? '/opt/star'
  const homeValue = process.env.DSH_HOME ?? '/var/lib/star/dsh'
  if (!isAbsolute(immutableValue)) fail('STAR_RUNTIME_ROOT must be absolute')
  if (!isAbsolute(homeValue)) fail('DSH_HOME must be absolute')
  const immutableRoot = resolve(immutableValue)
  const dshHome = resolve(homeValue)
  const lock = JSON.parse(await readFile(join(immutableRoot, 'capabilities.lock.json'), 'utf8'))
  if (lock.apiVersion !== 'star.employee.capabilities/v1alpha1') fail('unsupported capability lock')
  const profileName = lock.harness?.profile
  const presetId = lock.preset?.id
  if (typeof profileName !== 'string' || !/^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(profileName)) {
    fail('invalid locked Harness profile')
  }
  if (typeof presetId !== 'string' || !/^star-[0-9a-f]{64}$/.test(presetId)) {
    fail('invalid locked preset')
  }
  if (
    typeof lock.skillRoot?.path !== 'string' ||
    !/^skills\\/sha256-[0-9a-f]{64}$/.test(lock.skillRoot.path) ||
    lock.skillRoot.runtimePath !== \`/opt/star/\${lock.skillRoot.path}\`
  ) {
    fail('invalid locked skill root')
  }
  if (lock.preset.path !== \`dsh/agent-presets/\${presetId}\`) {
    fail('invalid locked preset path')
  }
  if (
    lock.bridge?.path !== 'bridge/plugin.mjs' ||
    lock.bridge?.runtimePath !== '/opt/star/bridge/plugin.mjs' ||
    typeof lock.bridge?.artifactDigest !== 'string'
  ) {
    fail('invalid locked supervisor bridge')
  }

  await verifyFile(join(immutableRoot, 'dsh/runtime/package.json'), lock.runtime.packageManifestDigest)
  await verifyFile(join(immutableRoot, 'dsh/runtime/pnpm-workspace.yaml'), lock.runtime.workspaceDigest)
  await verifyFile(join(immutableRoot, 'dsh/runtime/pnpm-lock.yaml'), lock.runtime.lockfileDigest)
  await verifyFile(join(immutableRoot, 'image/Dockerfile'), lock.image.dockerfileDigest)
  await verifyFile(fileURLToPath(import.meta.url), lock.image.entrypointDigest)
  await verifyFile(join(immutableRoot, lock.bridge.path), lock.bridge.artifactDigest)
  const skillRoot = join(immutableRoot, lock.skillRoot.path)
  if (await treeDigest(skillRoot) !== lock.skillRoot.digest) fail('immutable skill root digest differs')

  const presetSource = join(immutableRoot, lock.preset.path)
  const composition = await readFile(join(presetSource, 'agent.cordis.yml'), 'utf8')
  const metadata = await readFile(join(presetSource, 'preset.yml'), 'utf8')
  const presetDigest = sha256(
    \`star-preset-v1\\0agent.cordis.yml\\0\${Buffer.byteLength(composition)}\\0\${composition}\\0preset.yml\\0\${Buffer.byteLength(metadata)}\\0\${metadata}\`,
  )
  if (presetDigest !== lock.preset.digest) fail('immutable preset digest differs')
  if (composition.split(lock.skillRoot.runtimePath).length !== 2) {
    fail('managed preset must contain the locked runtime skill root exactly once')
  }

  const profileSource = join(immutableRoot, 'dsh/profile')
  const profilesRoot = join(dshHome, 'profiles')
  const profileTarget = join(profilesRoot, profileName)
  await ensureManagedDirectory(dshHome)
  await ensureManagedDirectory(profilesRoot)
  await ensureManagedDirectory(profileTarget)
  await writeManagedFile(
    join(profileSource, 'package.json'),
    join(profileTarget, 'package.json'),
    lock.profile.packageManifestDigest,
  )
  // The patch is emitted with the deployment bridge path
  // (/opt/star/bridge/plugin.mjs). When the immutable root lives elsewhere
  // (the host smoke), rewrite that literal to the actual artifact path so the
  // loader resolves the compiled bridge module.
  const patchContents = await verifyFile(
    join(profileSource, 'cordis.patch.yml'),
    lock.profile.patchDigest,
  )
  let activatedPatch = patchContents.toString('utf8')
  const bridgeSourcePath = join(immutableRoot, lock.bridge.path)
  if (bridgeSourcePath !== lock.bridge.runtimePath) {
    if (!activatedPatch.includes(lock.bridge.runtimePath)) {
      fail('managed profile patch must contain the locked bridge path exactly once')
    }
    activatedPatch = activatedPatch.replaceAll(lock.bridge.runtimePath, bridgeSourcePath)
  }
  await writeManagedContents(join(profileTarget, 'cordis.patch.yml'), activatedPatch)
  await writeManagedFile(
    join(profileSource, 'pnpm-workspace.yaml'),
    join(profileTarget, 'pnpm-workspace.yaml'),
    lock.profile.workspaceDigest,
  )
  const profileModules = join(profileTarget, 'node_modules')
  await rm(profileModules, { force: true, recursive: true })
  await symlink(join(immutableRoot, 'dsh/runtime/node_modules'), profileModules, 'dir')

  const presetTarget = join(dshHome, '.agent-presets', presetId)
  const presetTemporary = \`\${presetTarget}.star-\${process.pid}\`
  await ensureManagedDirectory(dirname(presetTarget))
  await rm(presetTemporary, { force: true, recursive: true })
  await cp(presetSource, presetTemporary, { recursive: true })
  await makeManagedTreeWritable(presetTemporary)
  const activatedSkillRoot = join(immutableRoot, lock.skillRoot.path)
  if (activatedSkillRoot !== lock.skillRoot.runtimePath) {
    const activatedComposition = composition.replace(
      lock.skillRoot.runtimePath,
      activatedSkillRoot,
    )
    if (activatedComposition === composition) {
      fail('managed preset does not contain the locked runtime skill root')
    }
    await writeFile(join(presetTemporary, 'agent.cordis.yml'), activatedComposition, 'utf8')
  }
  await rm(presetTarget, { force: true, recursive: true })
  await rename(presetTemporary, presetTarget)

  const dshManifestPath = join(immutableRoot, 'dsh/runtime/node_modules/@deepseek-ai/dsh/package.json')
  const dshManifest = JSON.parse(await readFile(dshManifestPath, 'utf8'))
  if (dshManifest.name !== lock.harness.package || dshManifest.version !== lock.harness.version) {
    fail('installed Harness identity differs from the lock')
  }
  return { lock, profileName, dshBin: join(dirname(dshManifestPath), 'lib/bin.js') }
}

const activated = await activate()
if (process.argv[2] === '--activate-only') {
  process.stdout.write(JSON.stringify({ profile: activated.profileName, preset: activated.lock.preset.id }) + '\\n')
} else {
  const args = process.argv.slice(2)
  process.argv = [process.execPath, activated.dshBin, '--profile', activated.profileName, ...(args.length > 0 ? args : ['--no-open'])]
  await import(pathToFileURL(activated.dshBin).href)
}
`
}
