import { Type, type Static, type TSchema } from '@sinclair/typebox'

const DIGEST_PATTERN = '^sha256:[0-9a-f]{64}$'
const INTEGRITY_PATTERN = '^sha512-[A-Za-z0-9+/]{86}==$'
const NPM_PACKAGE_PATTERN =
  '^(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$'
const DNS_LABEL_PATTERN = '^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$'
const RELATIVE_PATH_PATTERN = '^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$))[^\\\\]+$'
const SKILL_NAME_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$'
const SEMVER_PATTERN =
  '^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$'
const OCI_IMAGE_PATTERN =
  '^(?:[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[0-9]+)?/)*[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?@sha256:[0-9a-f]{64}$'
const strictObject = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false })

const Digest = Type.String({ pattern: DIGEST_PATTERN })
const Integrity = Type.String({ pattern: INTEGRITY_PATTERN })

const ResolvedSkillSource = Type.Union([
  strictObject({
    type: Type.Literal('local'),
    path: Type.String({ minLength: 1, pattern: RELATIVE_PATH_PATTERN }),
    treeDigest: Digest,
  }),
  strictObject({
    type: Type.Literal('git'),
    repository: Type.String({ minLength: 1 }),
    revision: Type.String({ pattern: '^[0-9a-f]{40}$' }),
    subpath: Type.Optional(
      Type.String({ minLength: 1, pattern: RELATIVE_PATH_PATTERN }),
    ),
    treeDigest: Digest,
  }),
  strictObject({
    type: Type.Literal('npm'),
    package: Type.String({ pattern: NPM_PACKAGE_PATTERN }),
    version: Type.String({ pattern: SEMVER_PATTERN }),
    subpath: Type.Optional(
      Type.String({ minLength: 1, pattern: RELATIVE_PATH_PATTERN }),
    ),
    integrity: Integrity,
    treeDigest: Digest,
  }),
])

export const CapabilityLockSchema = Type.Object(
  {
    apiVersion: Type.Literal('star.employee.capabilities/v1alpha1'),
    recipe: strictObject({
      apiVersion: Type.Literal('star.employee/v1alpha1'),
      name: Type.String({ minLength: 1, maxLength: 63, pattern: DNS_LABEL_PATTERN }),
      digest: Digest,
    }),
    harness: strictObject({
      package: Type.Literal('@deepseek-ai/dsh'),
      version: Type.Literal('0.1.1-rc.2'),
      integrity: Integrity,
      profile: Type.String({ minLength: 1, maxLength: 63, pattern: DNS_LABEL_PATTERN }),
    }),
    image: strictObject({
      base: Type.String({ minLength: 1, maxLength: 512, pattern: OCI_IMAGE_PATTERN }),
      dockerfileDigest: Digest,
      entrypointDigest: Digest,
    }),
    tools: strictObject({
      skillManager: strictObject({
        package: Type.Literal('skills'),
        version: Type.Literal('1.5.23'),
        integrity: Type.Literal(
          'sha512-+hMNBSi35yfX0sKD+ZcRm9y5or7u313OdkcvrRvJAsAzGCaA8wRTu2OmVdN0KRbk9ybqKby5dijkn6OVvNTUmw==',
        ),
        contentDigest: Digest,
      }),
      packageManager: strictObject({
        package: Type.Literal('pnpm'),
        version: Type.Literal('11.7.0'),
        integrity: Type.Literal(
          'sha512-GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA==',
        ),
        contentDigest: Digest,
      }),
    }),
    skills: Type.Array(
      strictObject({
        name: Type.String({
          minLength: 1,
          maxLength: 64,
          pattern: SKILL_NAME_PATTERN,
        }),
        source: ResolvedSkillSource,
        artifactDigest: Digest,
      }),
      { maxItems: 128 },
    ),
    skillRoot: strictObject({
      digest: Digest,
      path: Type.String({ pattern: '^skills/sha256-[0-9a-f]{64}$' }),
      runtimePath: Type.String({
        pattern: '^/opt/star/skills/sha256-[0-9a-f]{64}$',
      }),
    }),
    plugins: Type.Array(
      strictObject({
        id: Type.String({
          minLength: 1,
          maxLength: 63,
          pattern: DNS_LABEL_PATTERN,
        }),
        package: Type.String({ pattern: NPM_PACKAGE_PATTERN }),
        version: Type.String({ pattern: SEMVER_PATTERN }),
        entry: Type.String({ minLength: 1 }),
        integrity: Integrity,
      }),
      { maxItems: 128 },
    ),
    preset: strictObject({
      base: Type.Literal('standard'),
      baseDigest: Digest,
      digest: Digest,
      id: Type.String({ pattern: '^star-[0-9a-f]{64}$' }),
      path: Type.String({
        pattern: '^dsh/agent-presets/star-[0-9a-f]{64}$',
      }),
    }),
    profile: strictObject({
      packageManifestDigest: Digest,
      patchDigest: Digest,
      workspaceDigest: Digest,
    }),
    runtime: strictObject({
      lockfileDigest: Digest,
      packageManifestDigest: Digest,
      workspaceDigest: Digest,
    }),
  },
  {
    $id: 'https://star.employee/schemas/capability-lock.v1alpha1.schema.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    additionalProperties: false,
    title: 'Star Digital Employee Capability Lock v1alpha1',
  },
)

export type CapabilityLock = Static<typeof CapabilityLockSchema>
