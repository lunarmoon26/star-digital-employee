# 0009: Supervisor Bridge Protocol and Operation-ID Contract

Status: Accepted
Date: 2026-08-25

## Context

ADR 0001 committed to an opt-in DSH plugin exposing a bounded, authenticated
Unix-socket contract for bridge-owned sessions. M1 now needs the concrete wire
shape and the operation-ID contract that M2 durable channels depend on. Pinned
DSH ships a reference implementation of the same pattern in
`@deepseek-ai/dsh-openclaw-bridge`: a host Cordis plugin that opens an
owner-only Unix socket, authenticates peers with a token file, tracks the
sessions it created in a registry file, and drives them through `ctx.agents`.

DeepSeek Harness exposes the supervisor-relevant services on the host plane:

- `ctx.agents.create` / `ctx.agents.resume` build and publish a live `Agent`
  (one shared session id) through the registered loop factory.
- `ctx.agentPresets.mount(agentCtx, presetId)` is the only supported way to
  compose a session from a named preset, and must run inside the factory
  `setup` hook before publication.
- `ctx.sessionPersistence.inspect` reads a cold persisted session without
  resuming it; `ctx.agents` / `ctx.sessions` read live sessions.
- `session/event`, `agent/inbox/claimed`, `agent/inbox/discarded`, and
  `agent/disposed` carry the observation and cancellation facts a supervisor
  needs.

## Decision Drivers

- Every accepted input and external effect must have a stable operation ID
  (architecture cross-cutting rule).
- Bridge-owned sessions must remain ordinary DSH sessions so they stay visible,
  resumable, and cancellable in DSH Web.
- The supervisor must never import DSH internals or expose the raw DSH Web API.
- The bridge must prove idempotency before M2 durable channels begin.
- The frozen runtime graph is registry-only and must not be weakened to admit a
  first-party package.

## Options Considered

### Drive the DSH Web RPC over the socket

The Web API Proxy already exposes `session.*` methods, but it has no
authentication and no operation-scoped idempotency; reusing it would couple the
supervisor contract to the Web trust fence rather than an explicit boundary.

### Publish the bridge as an npm bundle installed into the profile

This matches the reference bundle pattern, but the employee runtime is a
frozen, registry-integrity-verified pnpm graph. Publishing a first-party
package and admitting a `file:`/`link:` resolution would weaken the lock
validation that M0 established.

### Ship a self-contained bridge module in the immutable tree

The bridge is compiled to one ESM file with only Node builtins at runtime,
placed under `/opt/star/bridge`, digest-pinned in the capability lock, and
referenced by the profile patch through an absolute module path. The frozen
lock and its integrity checks stay unchanged.

## Decision

Implement the bridge as a self-contained DSH host plugin compiled to a single
ESM file (`plugin.mjs`) with no runtime dependencies beyond Node builtins. The
compiler emits it into the immutable tree, records a content digest in the
capability lock, and adds an `insert` row to the generated profile patch that
loads it from an absolute path.

The plugin exposes a newline-delimited JSON protocol over an owner-only
(`0600`) Unix-domain socket and authenticates every request with a token read
from an owner-only token file. The protocol revision is `1`. Requests carry a
caller-minted correlation `id`, a stable `operationId` for mutating
operations, and the capability `token`.

Operations:

| Method | Effect | Operation-ID |
| --- | --- | --- |
| `session/create` | Create a session composed from the generated Star preset | required |
| `session/list` | List bridge-owned sessions with live activity | none |
| `session/status` | Status of one bridge-owned session | none |
| `session/observe` | Bounded event projection since a watermark | none |
| `session/history` | Bounded committed user/assistant text | none |
| `session/prompt` | Queue one prompt and await its owned turn | required |
| `session/cancel` | Cancel the active turn | required |
| `session/resume` | Cold-resume a persisted bridge-owned session | required |
| `session/dispose` | Tear down a live bridge-owned agent | required |

Every bridge-owned session records its session id, working directory, creation
time, and the exact Star preset id in a registry file. Operations reject any
session id absent from that registry, so the supervisor cannot reach a session
it does not own.

The operation-ID contract: mutating operations require a stable `operationId`
(1-128 characters). The bridge records the completed response for each
`operationId` in a bounded, file-persisted operation ledger and replays the
recorded result instead of re-executing, so a retried prompt does not enqueue a
second turn. Read operations do not require an operation id.

Preset selection is explicit: `session/create` and `session/resume` compose the
session from the preset id carried in the bridge configuration (the generated
`star-<digest>` preset from the capability lock), recorded in the session
header and mounted in the factory `setup` hook. The bridge does not fall back
to the deployment default preset.

## Consequences

- Positive: The supervisor gains a typed, authenticated, idempotent control
  boundary that does not depend on the DSH Web trust fence.
- Positive: The frozen runtime lock and its integrity checks are untouched; the
  bridge is a content-addressed immutable artifact.
- Positive: Operation idempotency is proven before M2 durable channels begin.
- Negative: The bridge is a first-party compiled artifact, so it must be rebuilt
  and re-digested whenever its protocol or behavior changes.
- Negative: Cancellation and prompt settlement rely on DSH event listeners whose
  semantics are pinned to the exact DSH release and covered by conformance tests.
- Follow-up: Durable channels (M2) consume the operation-ID contract and the
  bridge ownership registry as their inbox/outbox identity source.

## Confirmation

- The compiled artifact contains `bridge/plugin.mjs` and its digest is recorded
  in the capability lock.
- A bridge-created session selects the generated Star preset and exposes exactly
  the locked skill catalog.
- Replaying a `session/prompt` with the same `operationId` returns the recorded
  result without a second turn.
- `session/*` operations reject a session id absent from the ownership registry.
- A cold-resumed session is visible and resumable in DSH Web.
