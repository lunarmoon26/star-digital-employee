import { describe, expect, it } from 'vitest'
import { resolveExecutionProfile, validateLeaseRequest, type ExecutionProfile } from '../src/index.js'

const profiles: Readonly<Record<string, ExecutionProfile>> = {
  light: { provider: 'kubernetes', cpu: '1', memory: '2Gi' },
  'development-large': { provider: 'kubernetes', cpu: '8', memory: '64Gi', idleTimeoutMinutes: 30 },
}

function request(overrides: Partial<Parameters<typeof validateLeaseRequest>[0]> = {}) {
  return {
    profile: 'development-large',
    taskId: 'task-1',
    repository: 'https://github.com/example/repo.git',
    ...overrides,
  }
}

describe('workspace broker contract', () => {
  it('resolves a named execution profile', () => {
    expect(resolveExecutionProfile('development-large', profiles)?.memory).toBe('64Gi')
    expect(resolveExecutionProfile('missing', profiles)).toBeUndefined()
  })

  it('accepts a valid lease request against defined profiles', () => {
    expect(validateLeaseRequest(request(), profiles)).toEqual([])
  })

  it('rejects an undefined profile', () => {
    const issues = validateLeaseRequest(request({ profile: 'missing' }), profiles)
    expect(issues.map((issue) => issue.path)).toContain('/profile')
  })

  it('rejects a credential-bearing repository', () => {
    for (const repository of [
      'https://user:pass@github.com/example/repo.git',
      'https://github.com/example/repo.git?token=abc',
      'http://github.com/example/repo.git',
    ]) {
      const issues = validateLeaseRequest(request({ repository }), profiles)
      expect(issues.some((issue) => issue.path === '/repository')).toBe(true)
    }
  })

  it('rejects an empty task id and an empty branch', () => {
    expect(validateLeaseRequest(request({ taskId: '' }), profiles).some((issue) => issue.path === '/taskId')).toBe(true)
    expect(validateLeaseRequest(request({ branch: '' }), profiles).some((issue) => issue.path === '/branch')).toBe(true)
  })
})
