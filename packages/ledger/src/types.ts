/**
 * Durable supervisor ledger vocabulary. Every row is keyed by a stable
 * operation id so retries across process and pod replacement resolve to one
 * accepted operation. Channel and target values are strings owned by the
 * connector or effect gateway; the ledger does not interpret them.
 */

/** A stable operation id (caller-owned, 1..128 bytes). */
export type OperationId = string

/** Outcome of a durable external effect or delivery. */
export type EffectOutcome = 'pending' | 'completed' | 'failed' | 'unknown'

/** Lifecycle of an accepted inbound envelope. */
export type InboxStatus = 'accepted' | 'routed' | 'completed' | 'failed'

/** Lifecycle of a committed outbound obligation. */
export type OutboxStatus = 'pending' | 'delivered' | 'unknown' | 'failed'

/** Lifecycle of a derived task. */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** Lifecycle of an approval decision. */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

/** Canonical inbound envelope committed before provider acknowledgement. */
export interface InboundEnvelope {
  operationId: OperationId
  /** Stable identity supplied by the provider, used for deduplication. */
  providerEventId: string
  channel: string
  account: string
  thread?: string
  sender?: string
  /** Lossless JSON payload; must be JSON-serializable. */
  payload: unknown
}

/** A committed outbound obligation, recorded before delivery. */
export interface OutboundObligation {
  operationId: OperationId
  channel: string
  account: string
  recipient: string
  /** Lossless JSON payload; must be JSON-serializable. */
  payload: unknown
}

/** A recorded external mutation, settled after its provider outcome is known. */
export interface EffectRecord {
  operationId: OperationId
  target: string
  /** Lossless JSON arguments; must be JSON-serializable. */
  payload: unknown
  /** Optional provider idempotency key. */
  idempotencyKey?: string
}

/** A persisted inbound envelope row. */
export interface InboxRow {
  inboxId: number
  operationId: OperationId
  providerEventId: string
  channel: string
  account: string
  thread: string | null
  sender: string | null
  payload: unknown
  sessionId: string | null
  status: InboxStatus
  receivedAt: number
}

/** A persisted outbound obligation row. */
export interface OutboxRow {
  outboxId: number
  operationId: OperationId
  channel: string
  account: string
  recipient: string
  payload: unknown
  status: OutboxStatus
  providerMessageId: string | null
  deliveredAt: number | null
  createdAt: number
}

/** A persisted external-effect row. */
export interface EffectRow {
  effectId: number
  operationId: OperationId
  target: string
  payload: unknown
  idempotencyKey: string | null
  status: EffectOutcome
  decidedBy: string | null
  decidedAt: number | null
  createdAt: number
}

/** A persisted task row. */
export interface TaskRow {
  taskId: number
  operationId: OperationId
  inboxId: number
  sessionId: string | null
  status: TaskStatus
  createdAt: number
  updatedAt: number
}

/** A persisted approval row. */
export interface ApprovalRow {
  approvalId: number
  effectId: number
  status: ApprovalStatus
  approver: string | null
  decidedAt: number | null
  requestedAt: number
}

/** Result of accepting an inbound envelope (idempotent). */
export interface AcceptedInbound {
  operationId: OperationId
  inboxId: number
  taskId: number
  /** True when this call first committed the envelope; false on replay. */
  created: boolean
}

/** Result of enqueuing an outbound obligation (idempotent). */
export interface EnqueuedOutbound {
  operationId: OperationId
  outboxId: number
  created: boolean
}

/** Result of beginning an external effect (idempotent). */
export interface BegunEffect {
  operationId: OperationId
  effectId: number
  created: boolean
}

/** Delivery result: either the provider's message id or an ambiguous outcome. */
export type DeliveryResult = { providerMessageId: string } | { ambiguous: true }
