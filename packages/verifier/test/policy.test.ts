import { describe, expect, it } from 'vitest'
import { decideNext } from '../src/index.js'

const policy = { maxAttempts: 3 }

describe('escalation policy', () => {
  it('completes on a verified verdict', () => {
    expect(decideNext({ kind: 'verified' }, 1, policy)).toEqual({ action: 'complete' })
  })

  it('retries a failed verdict under the attempt bound', () => {
    expect(decideNext({ kind: 'failed', reason: 'bad output' }, 1, policy)).toEqual({ action: 'retry' })
    expect(decideNext({ kind: 'failed', reason: 'bad output' }, 2, policy)).toEqual({ action: 'retry' })
  })

  it('escalates once the attempt bound is exhausted', () => {
    const decision = decideNext({ kind: 'failed', reason: 'bad output' }, 3, policy)
    expect(decision.action).toBe('escalate')
    expect((decision as { reason: string }).reason).toContain('3 attempt')
  })

  it('escalates immediately on a needs-human verdict', () => {
    expect(decideNext({ kind: 'needs-human', reason: 'ambiguous identity' }, 1, policy)).toEqual({
      action: 'escalate',
      reason: 'ambiguous identity',
    })
  })
})
