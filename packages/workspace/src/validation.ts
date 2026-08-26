/**
 * Lease-request validation and profile resolution. A request must reference a
 * defined profile, a credential-free HTTPS repository, and a non-empty task id;
 * a provider may additionally bound the resolved size and quota.
 */

import type { ExecutionProfile, LeaseRequest } from './types.js'

export interface LeaseValidationIssue {
  path: string
  message: string
}

/** Resolve a named execution profile, or `undefined` when it is not defined. */
export function resolveExecutionProfile(
  name: string,
  profiles: Readonly<Record<string, ExecutionProfile>>,
): ExecutionProfile | undefined {
  return profiles[name]
}

/**
 * Validate a lease request before the broker provisions anything.
 * @param request - Untrusted request from the supervisor.
 * @param profiles - The recipe's `spec.execution.profiles`.
 */
export function validateLeaseRequest(
  request: LeaseRequest,
  profiles: Readonly<Record<string, ExecutionProfile>>,
): LeaseValidationIssue[] {
  const issues: LeaseValidationIssue[] = []

  if (request.profile === '') {
    issues.push({ path: '/profile', message: 'must not be empty' })
  } else if (resolveExecutionProfile(request.profile, profiles) === undefined) {
    issues.push({ path: '/profile', message: `references undefined profile "${request.profile}"` })
  }

  if (request.taskId === '') {
    issues.push({ path: '/taskId', message: 'must not be empty' })
  }

  try {
    const repository = new URL(request.repository)
    if (
      repository.protocol !== 'https:' ||
      repository.username !== '' ||
      repository.password !== '' ||
      repository.search !== '' ||
      repository.hash !== ''
    ) {
      issues.push({
        path: '/repository',
        message: 'must be a credential-free HTTPS URL without query or fragment',
      })
    }
  } catch {
    issues.push({ path: '/repository', message: 'must be a valid HTTPS URL' })
  }

  if (request.branch !== undefined && request.branch === '') {
    issues.push({ path: '/branch', message: 'must not be empty' })
  }

  return issues
}
