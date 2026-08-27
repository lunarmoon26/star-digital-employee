/**
 * Real `@slack/socket-mode` + `@slack/web-api` adapter for the Slack Socket Mode
 * connector. This is the only place the Slack SDKs and credentials enter the
 * process (ADR 0006); the connector itself stays SDK-agnostic and testable.
 */

import { SocketModeClient } from '@slack/socket-mode'
import { WebClient } from '@slack/web-api'
import {
  SlackSocketModeConnector,
  type SlackMessageEvent,
  type SlackSocketModeClient,
  type SlackWebClient,
} from './slack.js'

export interface SlackSdkConnectorOptions {
  /** Socket Mode app-level token (starts with `xapp-`). */
  appToken: string
  /** Bot user OAuth token (starts with `xoxb-`). */
  botToken: string
  /** Workspace identity label (for example the team id or a tenant name). */
  account: string
}

/** Build a Slack Socket Mode connector backed by the real Slack SDKs. */
export function createSlackSocketModeConnector(
  options: SlackSdkConnectorOptions,
): SlackSocketModeConnector {
  const realSocket = new SocketModeClient({ appToken: options.appToken })
  const realWeb = new WebClient(options.botToken)

  const socket: SlackSocketModeClient = {
    on(event, handler) {
      // socket-mode v3 emits events_api messages under the inner event type
      // (`message`, `app_mention`), passing `{ ack, body, event }`.
      realSocket.on(event, (args: { ack: (response?: unknown) => Promise<void>; event?: unknown }) => {
        void handler({
          ack: async () => { await args.ack() },
          event: args.event as SlackMessageEvent,
        })
      })
    },
    start: async () => { await realSocket.start() },
    disconnect: async () => { await realSocket.disconnect() },
  }

  const web: SlackWebClient = {
    async postMessage(input) {
      const result = await realWeb.chat.postMessage(input)
      if (result.ts === undefined) throw new Error('Slack chat.postMessage returned no ts')
      return { ts: result.ts }
    },
  }

  return new SlackSocketModeConnector(socket, web, options.account)
}
