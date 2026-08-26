import { describe, expect, it } from 'vitest'
import {
  activityIdempotencyKey,
  heartbeatDetailsFor,
  retryPolicyFor,
} from '../src/index.js'

describe('temporal workflow contract', () => {
  it('derives the prompt idempotency key for the process-task activity', () => {
    expect(activityIdempotencyKey('process-task', 'task-1')).toBe('prompt:task-1')
  })

  it('reuses the ledger operation id for delivery and effect activities', () => {
    expect(activityIdempotencyKey('deliver-outbox', 'out-1')).toBe('out-1')
    expect(activityIdempotencyKey('execute-effect', 'eff-1')).toBe('eff-1')
  })

  it('retries idempotent prompt turns but never ambiguous deliveries or effects', () => {
    expect(retryPolicyFor('process-task').maxAttempts).toBeGreaterThan(1)
    expect(retryPolicyFor('deliver-outbox').maxAttempts).toBe(1)
    expect(retryPolicyFor('execute-effect').maxAttempts).toBe(1)
  })

  it('carries the operation id in heartbeat details', () => {
    expect(heartbeatDetailsFor('task-1', 'running model turn')).toEqual({
      operationId: 'task-1',
      note: 'running model turn',
    })
  })
})
