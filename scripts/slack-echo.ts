/**
 * Live Slack Socket Mode echo loop (no model). Proves the connector's
 * commit-before-acknowledge + outbox-delivery path against a real workspace:
 * a Slack message is committed to the ledger, an echo reply is enqueued, and
 * the outbox pump delivers it back to the same channel/thread.
 *
 * Usage:
 *   SLACK_APP_TOKEN=xapp-... SLACK_BOT_TOKEN=xoxb-... \
 *   STAR_ACCOUNT=my-workspace pnpm tsx scripts/slack-echo.ts
 */

import { DurableLedger, type InboundEnvelope } from '@star/employee-ledger'
import {
  createSlackSocketModeConnector,
  optionalField,
  textOf,
} from '@star/employee-connector'

const appToken = process.env.SLACK_APP_TOKEN
const botToken = process.env.SLACK_BOT_TOKEN
if (!appToken || !botToken) {
  throw new Error('set SLACK_APP_TOKEN and SLACK_BOT_TOKEN (see .env.example)')
}
const account = process.env.STAR_ACCOUNT ?? 'default'
const ledgerPath = process.env.STAR_LEDGER_PATH ?? '.star/slack-echo.sqlite'

const ledger = new DurableLedger(ledgerPath)
const connector = createSlackSocketModeConnector({ appToken, botToken, account })

async function onEnvelope(envelope: InboundEnvelope): Promise<void> {
  const accepted = ledger.acceptInbound(envelope)
  if (!accepted.created) return
  const text = textOf(envelope.payload)
  const replyTo = optionalField(envelope.payload, 'replyTo') ?? envelope.sender ?? 'unknown'
  const threadId = optionalField(envelope.payload, 'threadId')
  ledger.enqueueOutbound({
    operationId: `echo:${envelope.operationId}`,
    channel: envelope.channel,
    account: envelope.account,
    recipient: replyTo,
    payload: { text: `echo: ${text}`, ...(threadId !== undefined ? { threadId } : {}) },
  })
}

async function drainOutbox(): Promise<void> {
  for (const row of ledger.listPendingOutbox()) {
    if (row.channel !== 'slack') continue
    const threadId = optionalField(row.payload, 'threadId')
    const result = await connector.deliver({
      channel: row.channel,
      account: row.account,
      recipient: row.recipient,
      text: textOf(row.payload),
      ...(threadId !== undefined ? { threadId } : {}),
    })
    ledger.recordDelivery(row.operationId, result)
  }
}

await connector.connect(onEnvelope)
process.stdout.write(`Slack echo connector listening for workspace "${account}" (ledger ${ledgerPath})\n`)

const timer = setInterval(() => { void drainOutbox().catch(console.error) }, 2_000)

async function shutdown(): Promise<void> {
  clearInterval(timer)
  await connector.disconnect()
  ledger.close()
  process.exit(0)
}

process.once('SIGINT', () => { void shutdown() })
process.once('SIGTERM', () => { void shutdown() })
