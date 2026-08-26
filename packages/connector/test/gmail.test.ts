import { describe, expect, it } from 'vitest'
import { gmailMessageToEnvelope } from '../src/index.js'

describe('gmail event normalization', () => {
  it('maps a message to a canonical envelope with reply-to = From', () => {
    const envelope = gmailMessageToEnvelope({
      id: 'gm-1',
      threadId: 'thread-1',
      snippet: 'hello from gmail',
      payload: { headers: [{ name: 'From', value: 'sender@haochuanz.net' }] },
    }, 'haochuanz.net')
    expect(envelope).toBeDefined()
    expect(envelope?.operationId).toBe('gmail:haochuanz.net:gm-1')
    expect(envelope?.sender).toBe('sender@haochuanz.net')
    expect(envelope?.thread).toBe('thread-1')
    expect(envelope?.payload).toEqual({
      text: 'hello from gmail',
      replyTo: 'sender@haochuanz.net',
      threadId: 'thread-1',
    })
  })

  it('skips messages without an id or a snippet', () => {
    expect(gmailMessageToEnvelope({ snippet: 'no id' }, 'x')).toBeUndefined()
    expect(gmailMessageToEnvelope({ id: 'gm-1', snippet: '' }, 'x')).toBeUndefined()
  })
})
