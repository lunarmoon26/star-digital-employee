# Changelog

All notable changes to Star Digital Employee are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Product contract, target architecture, implementation roadmap, and initial
  architecture decision records for the digital employee platform.
- Versioned `Employee` recipe contract and validation CLI foundation.
- Pinned open capability supply-chain contract for Agent Skills and Cordis npm
  plugins.
- Deterministic capability compiler with local, exact-Git, and exact-npm skill
  resolution, canonical locks, content-addressed skill roots, and DSH profile
  inputs.
- Digest-pinned Harness image generation with a frozen DSH runtime graph,
  idempotent writable-state activation, and an outbound-guarded DSH Web host smoke.
- Kubernetes topology decision (ADR 0008) and the hardened `employee-harness`
  Helm chart with static contract tests for the verified container constraints.
- Supervisor bridge (ADR 0009): a self-contained DSH host plugin exposing an
  owner-only Unix socket with an operation-id contract, ownership registry, and
  idempotency ledger; the compiler emits it into the immutable tree and records
  its digest in the capability lock.
- Web authentication boundary (ADR 0010): an in-pod authentication-proxy sidecar
  contract for the loopback-bound DSH Web surface, encoded in the chart with a
  local-dev bearer mode and a production OIDC mode.
- Durable supervisor ledger (`@star/employee-ledger`): a SQLite inbox/outbox/task/
  effect/approval ledger with operation-id idempotency, ambiguous-outcome
  `unknown` semantics, and restart-safe commit boundaries (ADR 0003).
- Supervisor state machine (`@star/employee-supervisor`): deterministic routing
  of accepted envelopes to one bridge-owned DSH session, idempotent prompt
  submission, outbound-obligation commitment from assistant output, and
  crash-recovery reconciliation.
- Connector host and Slack connector (`@star/employee-connector`): commit-before-
  acknowledge inbound normalization, outbox-drain delivery with ambiguous-outcome
  handling, and a credential-isolated, SDK-agnostic Slack Socket Mode adapter.
- Real Slack and Gmail SDK adapters (`createSlackSocketModeConnector`,
  `GmailConnector`) plus a live Slack echo script (`pnpm slack:echo`) and
  `.env.example`.
- Effect gateway (`@star/employee-gateway`): records external mutations before
  dispatch, gates approval-required targets, and settles effects with `unknown`
  ambiguity semantics and idempotent replay.
- Workspace broker contract (`@star/employee-workspace`, ADR 0011): a typed lease
  lifecycle and credential-free remote filesystem/subprocess surface with
  lease-request validation.
- Temporal workflow contract (`@star/employee-workflow`, ADR 0012): task
  workflows over the ledger with idempotent Activities, approval Signals/Updates,
  and effect-specific retry policy.
- Release readiness (ADR 0013): MIT license, CI gate, and `docs/release.md` with
  cosign signing, syft SBOM, backup/recovery runbooks, and the upgrade policy.
- Outcome verification and escalation (`@star/employee-verifier`, ADR 0014): a
  typed `Verifier` contract over task criteria and evidence plus `decideNext`
  escalation policy.

### Changed
- Removed the obsolete capability-migration milestone and legacy Claude marketplace
  content after the product-history reset.

[Unreleased]: https://github.com/lunarmoon26/star-digital-employee/commits/main
