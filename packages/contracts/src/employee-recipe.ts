import { Type, type Static, type TSchema } from '@sinclair/typebox'
import { Ajv2020, type ErrorObject } from 'ajv/dist/2020.js'

const DNS_LABEL_PATTERN = '^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$'
const REFERENCE_PATTERN = '^[a-z][a-z0-9-]{0,62}$'
const ENV_NAME_PATTERN = '^[A-Z_][A-Z0-9_]*$'
const SEMVER_PATTERN =
  '^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$'
const GIT_COMMIT_PATTERN = '^[0-9a-f]{40}$'
const NPM_PACKAGE_PATTERN =
  '^(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$'
const RELATIVE_PATH_PATTERN = '^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$))[^\\\\]+$'
const SKILL_NAME_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$'
const CPU_QUANTITY_PATTERN = '^(?:[1-9][0-9]*m|[1-9][0-9]*(?:\\.[0-9]+)?)$'
const MEMORY_QUANTITY_PATTERN = '^[1-9][0-9]*(?:Ki|Mi|Gi|Ti)$'
const MODEL_ROUTE_PATTERN = '^[a-zA-Z0-9._-]+/[a-zA-Z0-9._:/-]+$'

const strictObject = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false })

const Reference = Type.String({
  minLength: 1,
  maxLength: 63,
  pattern: DNS_LABEL_PATTERN,
})

const PackageRequirement = strictObject({
  name: Type.String({ minLength: 1, maxLength: 214 }),
  version: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
})

const LocalExecutionProfile = strictObject({
  provider: Type.Literal('local'),
  cpu: Type.Optional(Type.String({ pattern: CPU_QUANTITY_PATTERN })),
  memory: Type.Optional(Type.String({ pattern: MEMORY_QUANTITY_PATTERN })),
  approval: Type.Optional(
    Type.Union([Type.Literal('none'), Type.Literal('supervisor')]),
  ),
  idleTimeoutMinutes: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_080 })),
})

const KubernetesExecutionProfile = strictObject({
  provider: Type.Literal('kubernetes'),
  cpu: Type.String({ pattern: CPU_QUANTITY_PATTERN }),
  memory: Type.String({ pattern: MEMORY_QUANTITY_PATTERN }),
  approval: Type.Optional(
    Type.Union([Type.Literal('none'), Type.Literal('supervisor')]),
  ),
  idleTimeoutMinutes: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_080 })),
})

const ExecutionProfile = Type.Union([
  LocalExecutionProfile,
  KubernetesExecutionProfile,
])

const EnvironmentSource = strictObject({
  target: Type.Union([Type.Literal('harness'), Type.Literal('supervisor')]),
  valueFrom: strictObject({
    nonSecretConfigRef: Reference,
    key: Type.String({ minLength: 1, maxLength: 253, pattern: ENV_NAME_PATTERN }),
  }),
})

const RuntimeEnvironment = Type.Object(
  {
    LOG_LEVEL: Type.Optional(EnvironmentSource),
    TZ: Type.Optional(EnvironmentSource),
    LANG: Type.Optional(EnvironmentSource),
    NO_COLOR: Type.Optional(EnvironmentSource),
  },
  { additionalProperties: false, minProperties: 1 },
)

const SkillSource = strictObject({
  name: Type.String({ minLength: 1, maxLength: 64, pattern: SKILL_NAME_PATTERN }),
  source: Type.Union([
    strictObject({
      type: Type.Literal('local'),
      path: Type.String({
        minLength: 1,
        maxLength: 1024,
        pattern: RELATIVE_PATH_PATTERN,
      }),
    }),
    strictObject({
      type: Type.Literal('git'),
      repository: Type.String({ minLength: 1, maxLength: 2048 }),
      revision: Type.String({ pattern: GIT_COMMIT_PATTERN }),
      subpath: Type.Optional(
        Type.String({
          minLength: 1,
          maxLength: 1024,
          pattern: RELATIVE_PATH_PATTERN,
        }),
      ),
    }),
    strictObject({
      type: Type.Literal('npm'),
      package: Type.String({
        minLength: 1,
        maxLength: 214,
        pattern: NPM_PACKAGE_PATTERN,
      }),
      version: Type.String({ pattern: SEMVER_PATTERN }),
      subpath: Type.Optional(
        Type.String({
          minLength: 1,
          maxLength: 1024,
          pattern: RELATIVE_PATH_PATTERN,
        }),
      ),
    }),
  ]),
})

const CordisPlugin = strictObject({
  id: Type.String({ minLength: 1, maxLength: 63, pattern: DNS_LABEL_PATTERN }),
  package: Type.String({
    minLength: 1,
    maxLength: 214,
    pattern: NPM_PACKAGE_PATTERN,
  }),
  version: Type.String({ pattern: SEMVER_PATTERN }),
  entry: Type.String({ minLength: 1, maxLength: 512 }),
})

export const EmployeeRecipeSchema = Type.Object(
  {
    apiVersion: Type.Literal('star.employee/v1alpha1'),
    kind: Type.Literal('Employee'),
    metadata: strictObject({
      name: Type.String({
        minLength: 1,
        maxLength: 63,
        pattern: DNS_LABEL_PATTERN,
      }),
      labels: Type.Optional(
        Type.Record(
          Type.String({ pattern: DNS_LABEL_PATTERN }),
          Type.String({ minLength: 1, maxLength: 63 }),
          { additionalProperties: false },
        ),
      ),
    }),
    spec: strictObject({
      identity: strictObject({
        supervisorGroup: Reference,
        serviceAccount: Reference,
      }),
      harness: strictObject({
        package: Type.Literal('@deepseek-ai/dsh'),
        version: Type.Literal('0.1.1-rc.2'),
        profile: Reference,
      }),
      runtime: strictObject({
        baseImage: Type.String({ minLength: 1, maxLength: 512 }),
        systemPackages: Type.Array(PackageRequirement, { maxItems: 128 }),
        cliPackages: Type.Array(PackageRequirement, { maxItems: 128 }),
        environment: Type.Optional(RuntimeEnvironment),
        controlPod: strictObject({
          cpu: Type.String({ pattern: CPU_QUANTITY_PATTERN }),
          memory: Type.String({ pattern: MEMORY_QUANTITY_PATTERN }),
        }),
      }),
      model: strictObject({
        gatewayRef: Reference,
        default: Type.String({ pattern: MODEL_ROUTE_PATTERN }),
        budget: Type.Optional(
          strictObject({
            monthlyUsd: Type.Number({ minimum: 0 }),
          }),
        ),
      }),
      persona: Type.Optional(
        strictObject({
          instructions: Type.String({ minLength: 1, maxLength: 1024 }),
        }),
      ),
      skills: Type.Optional(Type.Array(SkillSource, { maxItems: 128 })),
      plugins: Type.Optional(Type.Array(CordisPlugin, { maxItems: 128 })),
      connectors: Type.Optional(
        Type.Object(
          {
            slack: Type.Optional(
              strictObject({
                accountRef: Reference,
              }),
            ),
            googleWorkspace: Type.Optional(
              strictObject({
                accountRef: Reference,
              }),
            ),
          },
          { additionalProperties: false, minProperties: 1 },
        ),
      ),
      tools: strictObject({
        defaultPolicy: Type.Union([
          Type.Literal('read-only'),
          Type.Literal('workspace-write'),
        ]),
        allow: Type.Array(Type.String({ minLength: 1, maxLength: 128 }), {
          maxItems: 256,
          uniqueItems: true,
        }),
        requireApproval: Type.Array(
          Type.String({ minLength: 1, maxLength: 128 }),
          { maxItems: 256, uniqueItems: true },
        ),
      }),
      execution: strictObject({
        defaultProfile: Reference,
        profiles: Type.Record(
          Type.String({ pattern: REFERENCE_PATTERN }),
          ExecutionProfile,
          { additionalProperties: false, minProperties: 1, maxProperties: 32 },
        ),
      }),
      memory: strictObject({
        volumeSize: Type.String({ pattern: MEMORY_QUANTITY_PATTERN }),
        retentionDays: Type.Integer({ minimum: 1, maximum: 3650 }),
      }),
      observability: strictObject({
        audit: Type.Union([
          Type.Literal('required'),
          Type.Literal('optional'),
          Type.Literal('disabled'),
        ]),
        contentCapture: Type.Boolean(),
      }),
    }),
  },
  {
    $id: 'https://star.employee/schemas/employee-recipe.v1alpha1.schema.json',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    additionalProperties: false,
    title: 'Star Digital Employee Recipe v1alpha1',
  },
)

export type EmployeeRecipe = Static<typeof EmployeeRecipeSchema>

export interface RecipeValidationIssue {
  keyword: string
  message: string
  path: string
}

export type RecipeValidationResult =
  | { ok: true; value: EmployeeRecipe }
  | { issues: RecipeValidationIssue[]; ok: false }

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
})
const validateSchema = ajv.compile<EmployeeRecipe>(EmployeeRecipeSchema)

function escapeJsonPointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1')
}

function issueFromAjv(error: ErrorObject): RecipeValidationIssue {
  if (error.keyword === 'additionalProperties') {
    const property = String(error.params.additionalProperty)
    return {
      keyword: error.keyword,
      message: `unknown field "${property}"`,
      path: `${error.instancePath}/${escapeJsonPointer(property)}` || '/',
    }
  }

  return {
    keyword: error.keyword,
    message: error.message ?? 'is invalid',
    path: error.instancePath || '/',
  }
}

function semanticIssues(recipe: EmployeeRecipe): RecipeValidationIssue[] {
  const issues: RecipeValidationIssue[] = []
  const profiles = recipe.spec.execution.profiles
  const defaultProfile = recipe.spec.execution.defaultProfile

  if (!(defaultProfile in profiles)) {
    issues.push({
      keyword: 'profileReference',
      message: `references undefined profile "${defaultProfile}"`,
      path: '/spec/execution/defaultProfile',
    })
  }

  const automaticallyAllowed = new Set(recipe.spec.tools.allow)
  for (const tool of recipe.spec.tools.requireApproval) {
    if (automaticallyAllowed.has(tool)) {
      issues.push({
        keyword: 'toolPolicyConflict',
        message: `tool "${tool}" cannot be both automatically allowed and approval-gated`,
        path: '/spec/tools/requireApproval',
      })
    }
  }

  for (const [field, packages] of [
    ['systemPackages', recipe.spec.runtime.systemPackages],
    ['cliPackages', recipe.spec.runtime.cliPackages],
  ] as const) {
    const seen = new Set<string>()
    for (const packageRequirement of packages) {
      if (seen.has(packageRequirement.name)) {
        issues.push({
          keyword: 'duplicatePackage',
          message: `package "${packageRequirement.name}" is declared more than once`,
          path: `/spec/runtime/${field}`,
        })
      }
      seen.add(packageRequirement.name)
    }
  }

  const skillNames = new Set<string>()
  for (const [index, skill] of (recipe.spec.skills ?? []).entries()) {
    if (skillNames.has(skill.name)) {
      issues.push({
        keyword: 'duplicateSkill',
        message: `skill "${skill.name}" is declared more than once`,
        path: '/spec/skills',
      })
    }
    skillNames.add(skill.name)

    if (skill.source.type !== 'git') continue
    try {
      const repository = new URL(skill.source.repository)
      if (
        repository.protocol !== 'https:' ||
        repository.username !== '' ||
        repository.password !== '' ||
        repository.search !== '' ||
        repository.hash !== ''
      ) {
        throw new Error('unsupported Git repository URL')
      }
    } catch {
      issues.push({
        keyword: 'gitRepository',
        message: 'must be a credential-free HTTPS URL without query or fragment',
        path: `/spec/skills/${index}/source/repository`,
      })
    }
  }

  const pluginIds = new Set<string>()
  const pluginPackageVersions = new Map<string, string>()
  for (const [index, plugin] of (recipe.spec.plugins ?? []).entries()) {
    if (pluginIds.has(plugin.id)) {
      issues.push({
        keyword: 'duplicatePlugin',
        message: `plugin "${plugin.id}" is declared more than once`,
        path: '/spec/plugins',
      })
    }
    pluginIds.add(plugin.id)

    const existingVersion = pluginPackageVersions.get(plugin.package)
    if (existingVersion && existingVersion !== plugin.version) {
      issues.push({
        keyword: 'pluginVersionConflict',
        message: `package "${plugin.package}" cannot use both "${existingVersion}" and "${plugin.version}"`,
        path: `/spec/plugins/${index}/version`,
      })
    }
    pluginPackageVersions.set(plugin.package, plugin.version)

    const entrySuffix = plugin.entry.slice(plugin.package.length)
    const validSubpath =
      plugin.entry.startsWith(`${plugin.package}/`) &&
      entrySuffix.startsWith('/') &&
      entrySuffix
        .slice(1)
        .split('/')
        .every((part) => part !== '' && part !== '.' && part !== '..')
    if (plugin.entry !== plugin.package && !validSubpath) {
      issues.push({
        keyword: 'pluginEntry',
        message: `must be "${plugin.package}" or one of its package subpaths`,
        path: `/spec/plugins/${index}/entry`,
      })
    }
  }

  return issues
}

export function validateEmployeeRecipe(value: unknown): RecipeValidationResult {
  if (!validateSchema(value)) {
    return {
      issues: (validateSchema.errors ?? []).map(issueFromAjv),
      ok: false,
    }
  }

  const recipe = value as EmployeeRecipe
  const issues = semanticIssues(recipe)
  if (issues.length > 0) return { issues, ok: false }

  return { ok: true, value: recipe }
}

export function formatRecipeIssues(issues: RecipeValidationIssue[]): string {
  return issues.map((issue) => `- ${issue.path}: ${issue.message}`).join('\n')
}
