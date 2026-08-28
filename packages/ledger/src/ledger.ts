/**
 * One-pod durable supervisor ledger (ADR 0003). SQLite with WAL + FULL sync
 * makes each acknowledged transaction durable across process replacement.
 * Every row is keyed by a stable operation id with a UNIQUE constraint, so a
 * replayed provider or supervisor operation resolves to one accepted row.
 */

import { DatabaseSync } from 'node:sqlite'
import { LEDGER_SCHEMA } from './schema.js'
import type {
  AcceptedInbound,
  ApprovalRow,
  BegunEffect,
  DeliveryResult,
  EffectOutcome,
  EffectRecord,
  EffectRow,
  EnqueuedOutbound,
  InboundEnvelope,
  InboxRow,
  OutboundObligation,
  OutboxRow,
  TaskRow,
  VerificationRecord,
} from './types.js'

const MAX_OPERATION_ID_BYTES = 128

function assertOperationId(value: string): void {
  if (typeof value !== 'string' || value === '' || Buffer.byteLength(value) > MAX_OPERATION_ID_BYTES) {
    throw new Error('ledger: operation id must be 1..128 bytes')
  }
}

function assertIdentifier(value: string, label: string): void {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`ledger: ${label} must be a non-empty string`)
  }
}

function encode(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    throw new Error('ledger: payload must be losslessly JSON-serializable')
  }
}

function decode<T>(value: string | null): T {
  return JSON.parse(value as string) as T
}

interface InboxDatabaseRow {
  inbox_id: number
  operation_id: string
  provider_event_id: string
  channel: string
  account: string
  thread: string | null
  sender: string | null
  payload: string
  session_id: string | null
  status: InboxRow['status']
  received_at: number
}

interface OutboxDatabaseRow {
  outbox_id: number
  operation_id: string
  channel: string
  account: string
  recipient: string
  payload: string
  status: OutboxRow['status']
  provider_message_id: string | null
  delivered_at: number | null
  created_at: number
}

interface EffectDatabaseRow {
  effect_id: number
  operation_id: string
  target: string
  payload: string
  idempotency_key: string | null
  status: EffectRow['status']
  decided_by: string | null
  decided_at: number | null
  created_at: number
}

interface TaskDatabaseRow {
  task_id: number
  operation_id: string
  inbox_id: number
  session_id: string | null
  status: TaskRow['status']
  created_at: number
  updated_at: number
}

interface ApprovalDatabaseRow {
  approval_id: number
  effect_id: number
  status: ApprovalRow['status']
  approver: string | null
  decided_at: number | null
  requested_at: number
}

interface VerificationDatabaseRow {
  verification_id: number
  task_operation_id: string
  attempt: number
  verdict: VerificationRecord['verdict']
  reason: string | null
  verified_at: number
}

export class DurableLedger {
  readonly #db: DatabaseSync

  constructor(path: string) {
    this.#db = new DatabaseSync(path)
    this.#db.exec(LEDGER_SCHEMA)
  }

  close(): void {
    this.#db.close()
  }

  /**
   * Commit a canonical inbound envelope and its derived task before the caller
   * acknowledges the provider. Replaying the same operation id returns the
   * already-accepted row without inserting a second one.
   */
  acceptInbound(envelope: InboundEnvelope): AcceptedInbound {
    assertOperationId(envelope.operationId)
    assertIdentifier(envelope.providerEventId, 'providerEventId')
    assertIdentifier(envelope.channel, 'channel')
    assertIdentifier(envelope.account, 'account')
    const payload = encode(envelope.payload)
    const now = Date.now()
    return this.#transaction(() => {
      const insert = this.#db.prepare(
        `INSERT OR IGNORE INTO inbox
           (operation_id, provider_event_id, channel, account, thread, sender, payload, session_id, status, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'accepted', ?)`,
      )
      const result = insert.run(
        envelope.operationId,
        envelope.providerEventId,
        envelope.channel,
        envelope.account,
        envelope.thread ?? null,
        envelope.sender ?? null,
        payload,
        now,
      )
      if (Number(result.changes) === 0) {
        const inbox = this.#inboxByOperation(envelope.operationId)
        const task = this.#taskByOperation(envelope.operationId)
        if (inbox === undefined || task === undefined) {
          throw new Error('ledger: replayed envelope is missing its inbox or task row')
        }
        return {
          operationId: envelope.operationId,
          inboxId: inbox.inboxId,
          taskId: task.taskId,
          created: false,
        }
      }
      const inboxId = Number(result.lastInsertRowid)
      const taskInsert = this.#db.prepare(
        `INSERT INTO tasks (operation_id, inbox_id, session_id, status, created_at, updated_at)
         VALUES (?, ?, NULL, 'pending', ?, ?)`,
      )
      const taskResult = taskInsert.run(envelope.operationId, inboxId, now, now)
      return {
        operationId: envelope.operationId,
        inboxId,
        taskId: Number(taskResult.lastInsertRowid),
        created: true,
      }
    })
  }

  /** Bind an accepted envelope to the bridge-owned DSH session it routes to. */
  routeInbound(operationId: string, sessionId: string): void {
    assertOperationId(operationId)
    assertIdentifier(sessionId, 'sessionId')
    const result = this.#db
      .prepare(`UPDATE inbox SET session_id = ?, status = 'routed' WHERE operation_id = ?`)
      .run(sessionId, operationId)
    if (Number(result.changes) === 0) throw new Error('ledger: unknown inbox operation')
    this.#db
      .prepare(`UPDATE tasks SET session_id = ?, updated_at = ? WHERE operation_id = ?`)
      .run(sessionId, Date.now(), operationId)
  }

  /** Mark an accepted envelope and its task completed after processing. */
  completeInbound(operationId: string): void {
    assertOperationId(operationId)
    const now = Date.now()
    const result = this.#db
      .prepare(`UPDATE inbox SET status = 'completed' WHERE operation_id = ?`)
      .run(operationId)
    if (Number(result.changes) === 0) throw new Error('ledger: unknown inbox operation')
    this.#db
      .prepare(`UPDATE tasks SET status = 'completed', updated_at = ? WHERE operation_id = ?`)
      .run(now, operationId)
  }

  /** Mark an accepted envelope and its task failed. */
  failInbound(operationId: string): void {
    assertOperationId(operationId)
    const now = Date.now()
    this.#db.prepare(`UPDATE inbox SET status = 'failed' WHERE operation_id = ?`).run(operationId)
    this.#db
      .prepare(`UPDATE tasks SET status = 'failed', updated_at = ? WHERE operation_id = ?`)
      .run(now, operationId)
  }

  /** List envelopes accepted but not yet completed (for restart reconciliation). */
  listIncompleteInbox(): InboxRow[] {
    return (
      this.#db
        .prepare(`SELECT * FROM inbox WHERE status IN ('accepted', 'routed') ORDER BY received_at`)
        .all() as unknown as InboxDatabaseRow[]
    ).map(mapInbox)
  }

  /** Record one outcome-verification attempt (ADR 0014). */
  recordVerification(
    taskOperationId: string,
    attempt: number,
    verdict: VerificationRecord['verdict'],
    reason?: string,
  ): VerificationRecord {
    assertOperationId(taskOperationId)
    if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error('ledger: verification attempt must be a positive safe integer')
    const result = this.#db
      .prepare(
        `INSERT INTO verifications (task_operation_id, attempt, verdict, reason, verified_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(taskOperationId, attempt, verdict, reason ?? null, Date.now())
    return {
      verificationId: Number(result.lastInsertRowid),
      taskOperationId,
      attempt,
      verdict,
      reason: reason ?? null,
      verifiedAt: Date.now(),
    }
  }

  /** List verification attempts for one task, oldest first. */
  verificationAttempts(taskOperationId: string): VerificationRecord[] {
    assertOperationId(taskOperationId)
    return (
      this.#db
        .prepare(`SELECT * FROM verifications WHERE task_operation_id = ? ORDER BY attempt`)
        .all(taskOperationId) as unknown as VerificationDatabaseRow[]
    ).map(mapVerification)
  }

  /** Park an envelope awaiting retry so reconcile does not reprocess it. */
  markInboxVerifying(operationId: string): void {
    assertOperationId(operationId)
    this.#db.prepare(`UPDATE inbox SET status = 'verifying' WHERE operation_id = ?`).run(operationId)
    this.#db.prepare(`UPDATE tasks SET status = 'verifying', updated_at = ? WHERE operation_id = ?`).run(Date.now(), operationId)
  }

  /** Mark an envelope as needing a human decision (escalation). */
  markInboxNeedsHuman(operationId: string): void {
    assertOperationId(operationId)
    this.#db.prepare(`UPDATE inbox SET status = 'needs-human' WHERE operation_id = ?`).run(operationId)
    this.#db.prepare(`UPDATE tasks SET status = 'needs-human', updated_at = ? WHERE operation_id = ?`).run(Date.now(), operationId)
  }

  /** Read the durable route assignment for a deterministic routing key. */
  routeFor(routeKey: string): string | undefined {
    assertIdentifier(routeKey, 'routeKey')
    const row = this.#db
      .prepare(`SELECT session_id FROM routes WHERE route_key = ?`)
      .get(routeKey) as { session_id: string } | undefined
    return row?.session_id
  }

  /** Persist the session a routing key maps to, first-write-wins. */
  assignRoute(routeKey: string, sessionId: string): void {
    assertIdentifier(routeKey, 'routeKey')
    assertIdentifier(sessionId, 'sessionId')
    this.#db
      .prepare(`INSERT OR IGNORE INTO routes (route_key, session_id) VALUES (?, ?)`)
      .run(routeKey, sessionId)
  }

  /**
   * Commit an outbound obligation before delivery. The caller must not report
   * success until `recordDelivery` records a provider message id.
   */
  enqueueOutbound(obligation: OutboundObligation): EnqueuedOutbound {
    assertOperationId(obligation.operationId)
    assertIdentifier(obligation.channel, 'channel')
    assertIdentifier(obligation.account, 'account')
    assertIdentifier(obligation.recipient, 'recipient')
    const payload = encode(obligation.payload)
    const result = this.#db
      .prepare(
        `INSERT OR IGNORE INTO outbox (operation_id, channel, account, recipient, payload, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        obligation.operationId,
        obligation.channel,
        obligation.account,
        obligation.recipient,
        payload,
        Date.now(),
      )
    if (Number(result.changes) === 0) {
      const existing = this.#outboxByOperation(obligation.operationId)
      if (existing === undefined) throw new Error('ledger: replayed outbox row is missing')
      return { operationId: obligation.operationId, outboxId: existing.outboxId, created: false }
    }
    return {
      operationId: obligation.operationId,
      outboxId: Number(result.lastInsertRowid),
      created: true,
    }
  }

  /**
   * Record the delivery result. An ambiguous outcome transitions the row to
   * `unknown`, never `completed`; a provider message id marks it delivered.
   */
  recordDelivery(operationId: string, result: DeliveryResult): void {
    assertOperationId(operationId)
    const row = this.#outboxByOperation(operationId)
    if (row === undefined) throw new Error('ledger: unknown outbox operation')
    if (row.status === 'delivered') return
    if ('ambiguous' in result) {
      if (row.status === 'unknown') return
      this.#db.prepare(`UPDATE outbox SET status = 'unknown' WHERE operation_id = ?`).run(operationId)
      return
    }
    this.#db
      .prepare(
        `UPDATE outbox SET status = 'delivered', provider_message_id = ?, delivered_at = ? WHERE operation_id = ?`,
      )
      .run(result.providerMessageId, Date.now(), operationId)
  }

  /** Reconcile a previously-ambiguous delivery once the provider outcome is known. */
  reconcileDelivery(operationId: string, providerMessageId: string): void {
    assertOperationId(operationId)
    assertIdentifier(providerMessageId, 'providerMessageId')
    const result = this.#db
      .prepare(
        `UPDATE outbox SET status = 'delivered', provider_message_id = ?, delivered_at = ? WHERE operation_id = ? AND status = 'unknown'`,
      )
      .run(providerMessageId, Date.now(), operationId)
    if (Number(result.changes) === 0) throw new Error('ledger: outbox row is not reconcilable')
  }

  /** Record an external mutation as pending before the caller dispatches it. */
  beginEffect(effect: EffectRecord): BegunEffect {
    assertOperationId(effect.operationId)
    assertIdentifier(effect.target, 'target')
    const payload = encode(effect.payload)
    const result = this.#db
      .prepare(
        `INSERT OR IGNORE INTO effects (operation_id, target, payload, idempotency_key, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      )
      .run(effect.operationId, effect.target, payload, effect.idempotencyKey ?? null, Date.now())
    if (Number(result.changes) === 0) {
      const existing = this.#effectByOperation(effect.operationId)
      if (existing === undefined) throw new Error('ledger: replayed effect row is missing')
      return { operationId: effect.operationId, effectId: existing.effectId, created: false }
    }
    return {
      operationId: effect.operationId,
      effectId: Number(result.lastInsertRowid),
      created: true,
    }
  }

  /** Settle an effect with a known terminal outcome. */
  settleEffect(operationId: string, outcome: 'completed' | 'failed'): void {
    assertOperationId(operationId)
    const result = this.#db
      .prepare(`UPDATE effects SET status = ? WHERE operation_id = ? AND status = 'pending'`)
      .run(outcome, operationId)
    if (Number(result.changes) === 0) throw new Error('ledger: effect is not pending')
  }

  /** Mark an effect ambiguous: its outcome is `unknown`, never completed. */
  markEffectUnknown(operationId: string): void {
    assertOperationId(operationId)
    const result = this.#db
      .prepare(`UPDATE effects SET status = 'unknown' WHERE operation_id = ? AND status = 'pending'`)
      .run(operationId)
    if (Number(result.changes) === 0) throw new Error('ledger: effect is not pending')
  }

  /** Request an approval gate for a pending effect; idempotent per effect. */
  requestApproval(effectOperationId: string): number {
    assertOperationId(effectOperationId)
    const effect = this.#effectByOperation(effectOperationId)
    if (effect === undefined) throw new Error('ledger: unknown effect operation')
    const insert = this.#db
      .prepare(
        `INSERT OR IGNORE INTO approvals (effect_id, status, requested_at) VALUES (?, 'pending', ?)`,
      )
      .run(effect.effectId, Date.now())
    if (Number(insert.changes) === 0) {
      const existing = this.#db
        .prepare(`SELECT approval_id FROM approvals WHERE effect_id = ?`)
        .get(effect.effectId) as { approval_id: number } | undefined
      if (existing === undefined) throw new Error('ledger: approval row is missing')
      return existing.approval_id
    }
    return Number(insert.lastInsertRowid)
  }

  /** Resolve an approval and stamp the decision onto the effect. */
  resolveApproval(approvalId: number, decision: 'approved' | 'rejected', approver: string): void {
    assertIdentifier(approver, 'approver')
    const now = Date.now()
    const result = this.#db
      .prepare(
        `UPDATE approvals SET status = ?, approver = ?, decided_at = ? WHERE approval_id = ? AND status = 'pending'`,
      )
      .run(decision, approver, now, approvalId)
    if (Number(result.changes) === 0) throw new Error('ledger: approval is not pending')
    const row = this.#db
      .prepare(`SELECT effect_id FROM approvals WHERE approval_id = ?`)
      .get(approvalId) as { effect_id: number } | undefined
    if (row !== undefined) {
      this.#db
        .prepare(`UPDATE effects SET decided_by = ?, decided_at = ? WHERE effect_id = ?`)
        .run(approver, now, row.effect_id)
    }
  }

  /** List effects whose outcome is ambiguous and awaiting reconciliation. */
  listUnknownEffects(): EffectRow[] {
    return (this.#db.prepare(`SELECT * FROM effects WHERE status = 'unknown'`).all() as unknown as EffectDatabaseRow[])
      .map(mapEffect)
  }

  /** List outbox rows still awaiting delivery confirmation. */
  listPendingOutbox(): OutboxRow[] {
    return (
      this.#db.prepare(`SELECT * FROM outbox WHERE status IN ('pending', 'unknown')`).all() as unknown as OutboxDatabaseRow[]
    ).map(mapOutbox)
  }

  inboxByOperation(operationId: string): InboxRow | undefined {
    return this.#inboxByOperation(operationId)
  }

  outboxByOperation(operationId: string): OutboxRow | undefined {
    return this.#outboxByOperation(operationId)
  }

  effectByOperation(operationId: string): EffectRow | undefined {
    return this.#effectByOperation(operationId)
  }

  approvalByEffect(operationId: string): ApprovalRow | undefined {
    const effect = this.#effectByOperation(operationId)
    if (effect === undefined) return undefined
    return this.#approvalByEffectId(effect.effectId)
  }

  approvalById(approvalId: number): ApprovalRow | undefined {
    const row = this.#db
      .prepare(`SELECT * FROM approvals WHERE approval_id = ?`)
      .get(approvalId) as unknown as ApprovalDatabaseRow | undefined
    if (row === undefined) return undefined
    return mapApproval(row)
  }

  effectById(effectId: number): EffectRow | undefined {
    const row = this.#db
      .prepare(`SELECT * FROM effects WHERE effect_id = ?`)
      .get(effectId) as unknown as EffectDatabaseRow | undefined
    if (row === undefined) return undefined
    return mapEffect(row)
  }

  #inboxByOperation(operationId: string): InboxRow | undefined {
    const row = this.#db
      .prepare(`SELECT * FROM inbox WHERE operation_id = ?`)
      .get(operationId) as unknown as InboxDatabaseRow | undefined
    if (row === undefined) return undefined
    return mapInbox(row)
  }

  #taskByOperation(operationId: string): TaskRow | undefined {
    const row = this.#db
      .prepare(`SELECT * FROM tasks WHERE operation_id = ?`)
      .get(operationId) as unknown as TaskDatabaseRow | undefined
    if (row === undefined) return undefined
    return {
      taskId: row.task_id,
      operationId: row.operation_id,
      inboxId: row.inbox_id,
      sessionId: row.session_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  #outboxByOperation(operationId: string): OutboxRow | undefined {
    const row = this.#db
      .prepare(`SELECT * FROM outbox WHERE operation_id = ?`)
      .get(operationId) as unknown as OutboxDatabaseRow | undefined
    if (row === undefined) return undefined
    return mapOutbox(row)
  }

  #effectByOperation(operationId: string): EffectRow | undefined {
    const row = this.#db
      .prepare(`SELECT * FROM effects WHERE operation_id = ?`)
      .get(operationId) as unknown as EffectDatabaseRow | undefined
    if (row === undefined) return undefined
    return mapEffect(row)
  }

  #approvalByEffectId(effectId: number): ApprovalRow | undefined {
    const row = this.#db
      .prepare(`SELECT * FROM approvals WHERE effect_id = ?`)
      .get(effectId) as unknown as ApprovalDatabaseRow | undefined
    if (row === undefined) return undefined
    return mapApproval(row)
  }

  #transaction<T>(operation: () => T): T {
    this.#db.exec('BEGIN IMMEDIATE')
    try {
      const result = operation()
      this.#db.exec('COMMIT')
      return result
    } catch (error) {
      this.#db.exec('ROLLBACK')
      throw error
    }
  }
}

function mapApproval(row: ApprovalDatabaseRow): ApprovalRow {
  return {
    approvalId: row.approval_id,
    effectId: row.effect_id,
    status: row.status,
    approver: row.approver,
    decidedAt: row.decided_at,
    requestedAt: row.requested_at,
  }
}

function mapVerification(row: VerificationDatabaseRow): VerificationRecord {
  return {
    verificationId: row.verification_id,
    taskOperationId: row.task_operation_id,
    attempt: row.attempt,
    verdict: row.verdict,
    reason: row.reason,
    verifiedAt: row.verified_at,
  }
}

function mapInbox(row: InboxDatabaseRow): InboxRow {
  return {
    inboxId: row.inbox_id,
    operationId: row.operation_id,
    providerEventId: row.provider_event_id,
    channel: row.channel,
    account: row.account,
    thread: row.thread,
    sender: row.sender,
    payload: decode(row.payload),
    sessionId: row.session_id,
    status: row.status,
    receivedAt: row.received_at,
  }
}

function mapOutbox(row: OutboxDatabaseRow): OutboxRow {
  return {
    outboxId: row.outbox_id,
    operationId: row.operation_id,
    channel: row.channel,
    account: row.account,
    recipient: row.recipient,
    payload: decode(row.payload),
    status: row.status,
    providerMessageId: row.provider_message_id,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
  }
}

function mapEffect(row: EffectDatabaseRow): EffectRow {
  return {
    effectId: row.effect_id,
    operationId: row.operation_id,
    target: row.target,
    payload: decode(row.payload),
    idempotencyKey: row.idempotency_key,
    status: row.status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  }
}

export type { EffectOutcome }
