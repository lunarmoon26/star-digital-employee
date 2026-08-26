/**
 * SQLite schema for the one-pod durable supervisor ledger (ADR 0003). WAL plus
 * FULL synchronous commits make an acknowledged transaction durable across
 * process replacement. Operation ids are UNIQUE across each ledger so a replayed
 * provider or supervisor operation resolves to one accepted row.
 */

export const LEDGER_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS inbox (
  inbox_id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL UNIQUE,
  provider_event_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  account TEXT NOT NULL,
  thread TEXT,
  sender TEXT,
  payload TEXT NOT NULL,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'accepted',
  received_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL UNIQUE,
  inbox_id INTEGER NOT NULL REFERENCES inbox(inbox_id),
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  outbox_id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL,
  account TEXT NOT NULL,
  recipient TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  delivered_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS effects (
  effect_id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL UNIQUE,
  target TEXT NOT NULL,
  payload TEXT NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT,
  decided_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  approval_id INTEGER PRIMARY KEY AUTOINCREMENT,
  effect_id INTEGER NOT NULL UNIQUE REFERENCES effects(effect_id),
  status TEXT NOT NULL DEFAULT 'pending',
  approver TEXT,
  decided_at INTEGER,
  requested_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inbox_provider ON inbox(channel, account, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
CREATE INDEX IF NOT EXISTS idx_effects_status ON effects(status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS routes (
  route_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL
);
`
