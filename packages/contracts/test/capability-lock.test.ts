import { Value } from '@sinclair/typebox/value'
import { describe, expect, it } from 'vitest'
import { CapabilityLockSchema, type CapabilityLock } from '../src/index.js'

function validLock(): CapabilityLock {
  const digest = `sha256:${'a'.repeat(64)}`
  return {
    apiVersion: 'star.employee.capabilities/v1alpha1',
    harness: {
      integrity:
        'sha512-UP1UIh6q3Gme/yXRn/QL2P8IsVlv8Shpg22TRJIZPsCRWLm4CBiA1MUvXmJAfsOEETBMLAl+xWPtFw6ICsN3wg==',
      package: '@deepseek-ai/dsh',
      profile: 'employee-web',
      version: '0.1.1-rc.2',
    },
    image: {
      base:
        'docker.io/library/node:24-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03',
      dockerfileDigest: digest,
      entrypointDigest: digest,
    },
    bridge: {
      artifactDigest: digest,
      path: 'bridge/plugin.mjs',
      runtimePath: '/opt/star/bridge/plugin.mjs',
    },
    plugins: [
      {
        entry: 'harness-alchemist/deepseek',
        id: 'harness-alchemist',
        integrity:
          'sha512-vksbcQAVt+vpWhhu1PXDACA5UHmS6N/Zs9C3cYEj4IlmzIUSwLz1bsw1QhkCd9bssSUKUD4rOwtEN5el1VQ0Uw==',
        package: 'harness-alchemist',
        version: '0.1.8',
      },
    ],
    profile: {
      packageManifestDigest: digest,
      patchDigest: digest,
      workspaceDigest: digest,
    },
    preset: {
      base: 'standard',
      baseDigest: digest,
      digest,
      id: `star-${'a'.repeat(64)}`,
      path: `dsh/agent-presets/star-${'a'.repeat(64)}`,
    },
    recipe: {
      apiVersion: 'star.employee/v1alpha1',
      digest,
      name: 'research-analyst',
    },
    runtime: {
      lockfileDigest: digest,
      packageManifestDigest: digest,
      workspaceDigest: digest,
    },
    skillRoot: {
      digest,
      path: `skills/sha256-${'a'.repeat(64)}`,
      runtimePath: `/opt/star/skills/sha256-${'a'.repeat(64)}`,
    },
    skills: [
      {
        artifactDigest: digest,
        name: 'harness-alchemist',
        source: {
          integrity:
            'sha512-vksbcQAVt+vpWhhu1PXDACA5UHmS6N/Zs9C3cYEj4IlmzIUSwLz1bsw1QhkCd9bssSUKUD4rOwtEN5el1VQ0Uw==',
          package: 'harness-alchemist',
          treeDigest: digest,
          type: 'npm',
          version: '0.1.8',
        },
      },
    ],
    tools: {
      packageManager: {
        contentDigest: digest,
        integrity:
          'sha512-GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA==',
        package: 'pnpm',
        version: '11.7.0',
      },
      skillManager: {
        contentDigest: digest,
        integrity:
          'sha512-+hMNBSi35yfX0sKD+ZcRm9y5or7u313OdkcvrRvJAsAzGCaA8wRTu2OmVdN0KRbk9ybqKby5dijkn6OVvNTUmw==',
        package: 'skills',
        version: '1.5.23',
      },
    },
  }
}

describe('Capability lock schema', () => {
  it('accepts exact tool, source, and artifact identities', () => {
    expect(Value.Check(CapabilityLockSchema, validLock())).toBe(true)
  })

  it('rejects floating package versions and unknown fields', () => {
    const lock = validLock() as CapabilityLock & { extra?: boolean }
    lock.plugins[0]!.version = 'latest'
    lock.extra = true

    expect(Value.Check(CapabilityLockSchema, lock)).toBe(false)
  })
})
