import { describe, expect, it } from 'vitest'
import {
  SlackSocketModeConnector,
  slackEventToEnvelope,
  type SlackMessageEvent,
  type SlackSocketModeClient,
  type SlackWebClient,
} from '../src/index.js'

class FakeSocket implements SlackSocketModeClient {
  readonly order: string[] = []
  ackCount = 0
  started = false
  #handler: ((payload: { ack: () => Promise<void>; event: SlackMessageEvent }) => void) | undefined

  on(
    _event: string,
    handler: (payload: { ack: () => Promise<void>; event: SlackMessageEvent }) => void,
  ): void {
    this.#handler = handler
  }

  async start(): Promise<void> {
    this.started = true
  }

  async disconnect(): Promise<void> {}

  async receive(event: SlackMessageEvent): Promise<void> {
    await this.#handler?.({
      ack: async () => {
        this.order.push('ack')
        this.ackCount += 1
      },
      event,
    })
  }
}

class FakeWeb implements SlackWebClient {
  posted: { channel: string; text: string; thread_ts?: string }[] = []
  result: { ts: string } = { ts: 'msg-1' }

  async postMessage(input: { channel: string; text: string; thread_ts?: string }): Promise<{ ts: string }> {
    this.posted.push(input)
    return this.result
  }
}

describe('slack event normalization', () => {
  it('maps a message event to a canonical envelope with stable identity', () => {
    const envelope = slackEventToEnvelope({
      type: 'message',
      channel: 'C1',
      user: 'U1',
      ts: '1700000000.000100',
      text: 'hello',
      client_msg_id: 'cm-1',
    }, 'acct-1')
    expect(envelope).toBeDefined()
    expect(envelope?.operationId).toBe('slack:acct-1:cm-1')
    expect(envelope?.providerEventId).toBe('cm-1')
    expect(envelope?.thread).toBe('1700000000.000100')
    expect(envelope?.sender).toBe('U1')
    expect(envelope?.payload).toEqual({
      text: 'hello',
      replyTo: 'C1',
      threadId: '1700000000.000100',
    })
  })

  it('skips non-message and empty events', () => {
    expect(slackEventToEnvelope({ type: 'app_mention', channel: 'C1', text: 'hi' }, 'acct-1')).toBeUndefined()
    expect(slackEventToEnvelope({ type: 'message', channel: 'C1', text: '' }, 'acct-1')).toBeUndefined()
  })
})

describe('slack socket mode connector', () => {
  it('commits the envelope before acknowledging the provider', async () => {
    const socket = new FakeSocket()
    const web = new FakeWeb()
    const connector = new SlackSocketModeConnector(socket, web, 'acct-1')
    const committed: string[] = []

    await connector.connect(async (envelope) => {
      committed.push(envelope.operationId)
      socket.order.push('commit')
    })
    expect(socket.started).toBe(true)

    await socket.receive({
      type: 'message',
      channel: 'C1',
      user: 'U1',
      ts: '1700000000.000100',
      text: 'hello',
      client_msg_id: 'cm-1',
    })

    expect(committed).toEqual(['slack:acct-1:cm-1'])
    expect(socket.order).toEqual(['commit', 'ack'])
    expect(socket.ackCount).toBe(1)
  })

  it('delivers a reply with its thread preserved', async () => {
    const socket = new FakeSocket()
    const web = new FakeWeb()
    const connector = new SlackSocketModeConnector(socket, web, 'acct-1')

    const result = await connector.deliver({
      channel: 'slack',
      account: 'acct-1',
      recipient: 'C1',
      text: 'reply',
      threadId: '1700000000.000100',
    })
    expect(result).toEqual({ providerMessageId: 'msg-1' })
    expect(web.posted).toEqual([
      { channel: 'C1', text: 'reply', thread_ts: '1700000000.000100' },
    ])
  })
})
