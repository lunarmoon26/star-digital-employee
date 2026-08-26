/**
 * Live Gmail echo loop (no model). Proves the connector's poll → commit →
 * outbox → deliver path against a real mailbox using Application Default
 * Credentials (ADC).
 *
 * One-time setup (grants Gmail scopes to ADC, opens a browser for consent):
 *   gcloud auth application-default login \
 *     --scopes="https://www.googleapis.com/auth/gmail.modify,https://www.googleapis.com/auth/gmail.send"
 *
 * Then:
 *   GMAIL_USER_ID=you@haochuanz.net STAR_ACCOUNT=haochuanz pnpm gmail:echo
 */

// Load .env from the repository root (optional).
try {
  process.loadEnvFile()
} catch {
  // No .env file — fall back to already-exported environment variables.
}

import { DurableLedger, type InboundEnvelope } from '@star/employee-ledger'
import {
  createGmailConnectorFromAdc,
  optionalField,
  textOf,
} from '@star/employee-connector'

const userId = process.env.GMAIL_USER_ID ?? 'me'
const account = process.env.STAR_ACCOUNT ?? 'gmail'
const ledgerPath = process.env.STAR_LEDGER_PATH ?? '.star/gmail-echo.sqlite'

const ledger = new DurableLedger(ledgerPath)
const connector = await createGmailConnectorFromAdc({ userId, account })

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
    if (row.channel !== 'gmail') continue
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
process.stdout.write(`Gmail echo connector monitoring "${userId}" (account "${account}", ledger ${ledgerPath})\n`)

const timer = setInterval(() => { void drainOutbox().catch(console.error) }, 5_000)

async function shutdown(): Promise<void> {
  clearInterval(timer)
  await connector.disconnect()
  ledger.close()
  process.exit(0)
}

process.once('SIGINT', () => { void shutdown() })
process.once('SIGTERM', () => { void shutdown() })
