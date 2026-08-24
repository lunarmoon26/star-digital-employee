# 0001: Use DeepSeek Harness Behind a Pinned Process Boundary

Status: Accepted
Date: 2026-08-24

## Context

The employee needs a capable agent loop, model adapters, tools, skills, sessions,
and a direct Web interface. DeepSeek Harness provides these through replaceable
Cordis services and an append-only session model, but release `0.1.1-rc.2` is a
developer preview with breaking changes expected. Its Web API is not an external
authentication boundary and its local scheduling is not durable.

## Decision Drivers

- Reuse the Harness Web and tool experience without rebuilding an agent loop.
- Keep channels, business durability, identity, and deployment policy under product
  ownership.
- Detect upstream breaking changes before production rollout.
- Keep ordinary supervisor-created sessions visible in the Harness Web UI.

## Options Considered

### Embed Harness packages throughout the supervisor

This offers direct APIs but couples the platform to preview internals and makes
upgrades broad and difficult to test.

### Drive the Web API or terminal externally

This avoids a plugin but relies on a surface without production authentication or
operation-scoped idempotency. Terminal scraping is not a control protocol.

### Mount a narrow bridge plugin and use a process boundary

This preserves native sessions and extension points while limiting the integration
contract to explicit, testable operations.

## Decision

Install an exact `@deepseek-ai/dsh` version in the employee image. Mount an opt-in
DSH plugin exposing a bounded, authenticated Unix-socket contract for bridge-owned
sessions. The supervisor does not import DSH internals directly or expose the raw
DSH Web API.

## Consequences

- Positive: DSH remains responsible for its strongest capabilities and Web UI.
- Positive: The supervisor contract can be versioned and conformance tested.
- Negative: The bridge plugin still uses preview extension APIs and needs exact peer
  compatibility.
- Negative: One additional process and protocol boundary must be operated.
- Follow-up: Every DSH upgrade runs packed-install, session-resume, browser
  concurrency, cancellation, policy, and bridge ownership tests.

## Confirmation

- The built image reports the locked DSH version.
- Bridge-created sessions appear and resume in DSH Web.
- Duplicate operation IDs do not insert duplicate prompts.
- Sessions outside the bridge ownership registry are rejected.
