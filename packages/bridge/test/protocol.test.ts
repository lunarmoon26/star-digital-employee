import { describe, expect, it } from 'vitest'
import {
  BRIDGE_PROTOCOL_VERSION,
  failure,
  isMutatingMethod,
  isRecord,
  parseBridgeRequest,
  responseFrame,
  validOperationId,
} from '../src/protocol.js'

describe('bridge protocol framing', () => {
  it('parses a valid mutating request with an operation id', () => {
    const request = parseBridgeRequest({
      version: BRIDGE_PROTOCOL_VERSION,
      id: 'req-1',
      operationId: 'op-1',
      token: 'secret',
      method: 'session/prompt',
      params: { sessionId: 'star-1', text: 'hi' },
    })
    expect(request).toEqual({
      version: BRIDGE_PROTOCOL_VERSION,
      id: 'req-1',
      operationId: 'op-1',
      token: 'secret',
      method: 'session/prompt',
      params: { sessionId: 'star-1', text: 'hi' },
    })
  })

  it('parses a read request without an operation id', () => {
    const request = parseBridgeRequest({
      version: BRIDGE_PROTOCOL_VERSION,
      id: 'req-2',
      token: 'secret',
      method: 'session/list',
      params: {},
    })
    expect(request?.operationId).toBeUndefined()
    expect(request?.method).toBe('session/list')
  })

  it('rejects a request with the wrong protocol version', () => {
    expect(parseBridgeRequest({
      version: 2,
      id: 'req-3',
      token: 'secret',
      method: 'session/list',
      params: {},
    })).toBeUndefined()
  })

  it('rejects an unknown method', () => {
    expect(parseBridgeRequest({
      version: BRIDGE_PROTOCOL_VERSION,
      id: 'req-4',
      token: 'secret',
      method: 'session/steal',
      params: {},
    })).toBeUndefined()
  })

  it('rejects a malformed operation id', () => {
    expect(parseBridgeRequest({
      version: BRIDGE_PROTOCOL_VERSION,
      id: 'req-5',
      operationId: '   ',
      token: 'secret',
      method: 'session/cancel',
      params: { sessionId: 'star-1' },
    })).toBeUndefined()
  })

  it('emits a newline-terminated response frame', () => {
    const frame = responseFrame({ id: 'req-1', ok: true, value: { accepted: true } })
    expect(frame.endsWith('\n')).toBe(true)
    expect(JSON.parse(frame)).toEqual({ id: 'req-1', ok: true, value: { accepted: true } })
  })
})

describe('bridge operation-id contract helpers', () => {
  it('classifies only the mutating methods', () => {
    expect(isMutatingMethod('session/create')).toBe(true)
    expect(isMutatingMethod('session/prompt')).toBe(true)
    expect(isMutatingMethod('session/cancel')).toBe(true)
    expect(isMutatingMethod('session/resume')).toBe(true)
    expect(isMutatingMethod('session/dispose')).toBe(true)
    expect(isMutatingMethod('session/list')).toBe(false)
    expect(isMutatingMethod('session/observe')).toBe(false)
    expect(isMutatingMethod('session/history')).toBe(false)
  })

  it('accepts and trims a bounded operation id', () => {
    expect(validOperationId('  op-1  ')).toBe('op-1')
    expect(validOperationId('')).toBeUndefined()
    expect(validOperationId('x'.repeat(129))).toBeUndefined()
    expect(validOperationId(123)).toBeUndefined()
  })

  it('shapes a failure envelope with a stable code', () => {
    expect(failure('req-1', 'not-found', 'missing')).toEqual({
      id: 'req-1',
      ok: false,
      error: { code: 'not-found', message: 'missing' },
    })
  })

  it('treats only non-array objects as records', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('x')).toBe(false)
  })
})
