import { describe, expect, it } from 'vitest'
import {
  formatRecipeIssues,
  validateEmployeeRecipe,
  type EmployeeRecipe,
} from '../src/index.js'

function validRecipe(): EmployeeRecipe {
  return {
    apiVersion: 'star.employee/v1alpha1',
    kind: 'Employee',
    metadata: {
      name: 'research-analyst',
    },
    spec: {
      execution: {
        defaultProfile: 'light',
        profiles: {
          light: {
            provider: 'local',
          },
          'development-large': {
            approval: 'supervisor',
            cpu: '16',
            memory: '64Gi',
            provider: 'kubernetes',
          },
        },
      },
      harness: {
        package: '@deepseek-ai/dsh',
        profile: 'employee-web',
        version: '0.1.1-rc.2',
      },
      identity: {
        serviceAccount: 'research-analyst',
        supervisorGroup: 'analysts',
      },
      memory: {
        retentionDays: 365,
        volumeSize: '20Gi',
      },
      model: {
        default: 'deepseek/deepseek-chat',
        gatewayRef: 'organization-model-gateway',
      },
      observability: {
        audit: 'required',
        contentCapture: false,
      },
      runtime: {
        baseImage: 'node:24-bookworm-slim',
        cliPackages: [],
        controlPod: {
          cpu: '1',
          memory: '2Gi',
        },
        environment: {
          LOG_LEVEL: {
            target: 'supervisor',
            valueFrom: {
              nonSecretConfigRef: 'employee-settings',
              key: 'LOG_LEVEL',
            },
          },
        },
        systemPackages: [{ name: 'git' }],
      },
      tools: {
        allow: ['wiki.search'],
        defaultPolicy: 'read-only',
        requireApproval: ['mail.send'],
      },
    },
  }
}

describe('Employee recipe validation', () => {
  it('accepts a complete recipe', () => {
    expect(validateEmployeeRecipe(validRecipe())).toEqual({
      ok: true,
      value: validRecipe(),
    })
  })

  it('rejects unknown and inline credential fields', () => {
    const recipe = validRecipe() as EmployeeRecipe & {
      spec: EmployeeRecipe['spec'] & { apiKey: string }
    }
    recipe.spec.apiKey = 'not-a-real-secret'

    const result = validateEmployeeRecipe(recipe)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(formatRecipeIssues(result.issues)).toContain(
      '/spec/apiKey: unknown field "apiKey"',
    )
  })

  it('rejects credential-oriented environment names', () => {
    const recipe = validRecipe()
    recipe.spec.runtime.environment = {
      MODEL_API_KEY: {
        target: 'harness',
        valueFrom: {
          nonSecretConfigRef: 'employee-settings',
          key: 'MODEL_API_KEY',
        },
      },
    } as unknown as NonNullable<EmployeeRecipe['spec']['runtime']['environment']>

    const result = validateEmployeeRecipe(recipe)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        keyword: 'additionalProperties',
        path: '/spec/runtime/environment/MODEL_API_KEY',
      }),
    )
  })

  it('rejects an undefined default execution profile', () => {
    const recipe = validRecipe()
    recipe.spec.execution.defaultProfile = 'missing'

    const result = validateEmployeeRecipe(recipe)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toContainEqual(
      expect.objectContaining({ keyword: 'profileReference' }),
    )
  })

  it('rejects invalid dynamic map keys', () => {
    const recipe = validRecipe()
    recipe.spec.runtime.environment = {
      'lower-case': {
        target: 'supervisor',
        valueFrom: {
          nonSecretConfigRef: 'employee-settings',
          key: 'LOG_LEVEL',
        },
      },
    } as unknown as NonNullable<EmployeeRecipe['spec']['runtime']['environment']>

    const result = validateEmployeeRecipe(recipe)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(formatRecipeIssues(result.issues)).toContain(
      '/spec/runtime/environment/lower-case: unknown field "lower-case"',
    )
  })

  it('rejects inline credentials hidden in an environment value', () => {
    const recipe = validRecipe()
    recipe.spec.runtime.environment = {
      DATABASE_URL: 'postgres://employee:password@example.invalid/database',
    } as unknown as NonNullable<EmployeeRecipe['spec']['runtime']['environment']>

    const result = validateEmployeeRecipe(recipe)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: '/spec/runtime/environment/DATABASE_URL',
      }),
    )
  })

  it('requires resource declarations for Kubernetes profiles', () => {
    const recipe = validRecipe()
    recipe.spec.execution.profiles['development-large'] = {
      provider: 'kubernetes',
    } as unknown as EmployeeRecipe['spec']['execution']['profiles'][string]

    const result = validateEmployeeRecipe(recipe)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: expect.stringContaining('development-large') }),
    )
  })
})
