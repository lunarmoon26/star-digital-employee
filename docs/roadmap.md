# Implementation Roadmap

Status: Proposed sequencing for accepted product behavior

This document owns unimplemented work and delivery order. It does not override the
product contract, exact schemas, or accepted architecture decisions.

## Milestones

| Milestone | Status | Scope | Exit gate |
| --- | --- | --- | --- |
| M0 Contract foundation | Implemented | Canonical documentation, initial ADRs, TypeScript workspace, recipe schema, validation CLI | Documented valid and invalid recipe workflows pass `pnpm check`. |
| M1 Harness core | In progress | Runtime image, locked open capabilities, generated DSH profile and preset, owner-only supervisor bridge, local Docker topology | A supervisor-created ordinary session uses only locked skills and plugins and is visible, resumable, and cancellable in DSH Web. |
| M2 Durable employee | In progress | Transactional inbox/outbox/task/effect ledger, Slack Socket Mode, Gmail API connector, approvals, TUI | Restart and fault-injection tests prove accepted messages are not lost and terminal operations are not duplicated. |
| M3 Kubernetes production | In progress | Helm deployment, PVC, OIDC proxy, NetworkPolicy, quotas, workspace broker, remote DSH providers | A 64 GiB task runs remotely while the employee pod retains normal limits and credentials remain isolated. |
| M4 Temporal workflows | In progress | Temporal worker, schedules, Signals/Updates, heartbeat Activities, workflow cancellation | A multi-step approved task survives employee pod deletion and replacement. |
| M5 Release readiness | In progress | CI, image signing, SBOM, backups, recovery runbooks, license, upgrade policy | Release artifact and disaster-recovery evidence satisfy documented gates. |

## M1 Harness Core

Completed in the capability-compilation and image slices:

1. Extended the recipe with exact local, Git, and npm Agent Skill sources plus
   exact npm Cordis package entries.
2. Pinned `skills@1.5.23` as a build adapter and independently validated and hashed
   its selected output.
3. Added a capability lock, content-addressed skill root, exact profile dependency
   manifest, and Cordis patch rows. Exact Git and npm forms of the public Harness
   Alchemist artifact produce the same selected skill digest.
4. Derived a content-addressed Star preset from the integrity-verified DSH package
   with one locked skill root, default roots disabled, and watching disabled.
5. Generated and validated one frozen pnpm v9 runtime graph with pinned pnpm,
   automatic peer installation disabled, explicit DSH support peers, exact direct
   integrity, and integrity for every transitive registry package.
6. Emitted a digest-pinned multi-stage Node.js 24 image definition whose final
   stage excludes package-manager and Git entry points and runs as non-root.
7. Added idempotent activation that restores only deployment-owned profile and
   preset inputs while preserving DSH state.
8. Proved the real Harness Alchemist graph with a frozen offline install and a DSH
   Web RPC host smoke that blocks non-loopback Node TCP connections, selects the
   generated preset, and exposes exactly the locked skill catalog.
9. Built the generated image with Docker and ran it under `--network none`,
   read-only root, dropped capabilities, no-new-privileges, and non-root. In-container
   checks proved package-manager and Git executables are absent, DSH Web reaches
   ready, the locked preset is healthy and default, a session exposes exactly the
   locked skill, and restart reactivates idempotently. Writable temporary mounts
   must allow execution because pinned DSH materializes native bindings into
   `$TMPDIR` before loading them.

The supervisor-boundary slice is implemented in source and covered by unit and
compiler tests (ADR 0009), but its runtime conformance against a live Harness is
the remaining M1 gate:

1. Implemented the bounded, owner-only Unix-socket bridge as a self-contained DSH
   host plugin (`@star/employee-bridge`). It speaks a newline-delimited JSON
   protocol with a required operation id for every mutating operation, an
   authenticated capability token, a durable ownership registry, and a bounded
   operation-id ledger for idempotent replay.
2. Implemented the `session/create`, `prompt`, `observe`, `cancel`, `resume`,
   `dispose`, `list`, `status`, and `history` operations. Create and resume
   explicitly compose the generated Star preset via the session header plus the
   factory `setup` mount.
3. The compiler emits the compiled bridge into the immutable tree, records its
   content digest in the capability lock, adds the bridge host row to the
   generated profile patch, and the image activation verifies the bridge digest.

Proven at runtime by the outbound-guarded host smoke against `@deepseek-ai/dsh`
`0.1.1-rc.2`, using an inline OpenAI-compatible streaming mock for the model:

4. A bridge-created session selects the generated Star preset and exposes exactly
   the locked skill catalog; it is visible in DSH Web with the locked preset.
   `session/list`, `status`, `observe`, `cancel`, `dispose`, and cold `resume`
   behave as specified; a replayed `session/create` operation id returns the
   recorded session instead of creating a second one; and a foreign session id is
   rejected with `not-found`. Mutating operations without an operation id, and
   prompts with empty text, are rejected with `invalid-request`.
5. `session/prompt` runs a real turn through the pinned DeepSeek adapter against
   the mock, settles at `turn/end` with the assistant reply, and a replayed
   prompt operation id returns the recorded result without a second model
   request. `session/observe` projects the completed turn and `session/history`
   returns the assistant message.

The Web authentication boundary is defined (ADR 0010): DSH Web stays
loopback-bound and unauthenticated, and an in-pod sidecar sharing the pod network
namespace is the only published port, terminating TLS/identity and forwarding to
`127.0.0.1:3080` while preserving `Host`, upgrading the two `/api/events.*`
WebSockets, and keeping `application/json` on POSTs. The chart encodes the sidecar
slot, the loopback upstream, and the proxy-only Service, with a local-dev bearer
mode and a production OIDC mode.

6. The operation ledger and ownership registry survive a DSH restart: a
   replayed `session/create` and `session/prompt` operation id after process
   replacement return the recorded outcomes, `session/list` still owns exactly
   the original session, and no new model request is made.

The bridge operation-ID contract is now proven at runtime, including across
restart, so durable channel work (M2) can begin. Remaining M1 scope is the
authentication sidecar end-to-end (a real proxy image against the kind cluster)
and browser-plus-supervisor concurrency against one session.

## M2 Durable Employee

Completed in the durable-ledger slice (ADR 0003):

1. Added `@star/employee-ledger`, a one-pod SQLite ledger (WAL + full synchronous
   commits) with `inbox`, `tasks`, `outbox`, `effects`, and `approvals` tables.
   Every row is keyed by a stable operation id with a UNIQUE constraint, so a
   replayed provider or supervisor operation resolves to one accepted row.
2. Implemented the commit boundaries: `acceptInbound` commits an envelope and its
   task before acknowledgement; `enqueueOutbound` commits an obligation before
   delivery; `recordDelivery` maps an ambiguous timeout to `unknown` and only
   `reconcileDelivery` later marks it delivered; `beginEffect` records an external
   mutation pending, and `markEffectUnknown` / `settleEffect` resolve it without
   ever auto-completing an ambiguous outcome.
3. Added restart and idempotency tests: an acknowledged envelope survives ledger
   reopen, a replayed operation id returns the accepted row without inserting a
   second one, and ambiguous delivery/effect outcomes stay `unknown` until
   explicit reconciliation.
4. Added `@star/employee-supervisor`: the state machine wires the ledger to the
   bridge. It routes a canonical envelope deterministically to one bridge-owned
   session (persisted route map), submits an idempotent prompt operation derived
   from the envelope operation id, commits assistant output as outbound
   obligations, and `reconcile()` resumes envelopes left incomplete by a crash.
   Unit tests prove routing determinism, replay dedup, and restart recovery.

5. Added `@star/employee-connector`: the generic connector host commits each
   provider event before acknowledgement and drains the outbox while recording
   delivery outcomes, and the Slack Socket Mode connector normalizes message
   events into canonical envelopes and delivers threaded replies through
   injectable socket/web client interfaces (credential-isolated, SDK-agnostic).
   Unit tests prove commit-before-ack ordering, reply threading, and
   ambiguous-delivery handling.

6. Added `@star/employee-gateway`: the effect gateway records each external
   mutation before dispatch, gates approval-required targets behind a human
   decision, and settles effects from their provider outcome — an ambiguous or
   throwing dispatch resolves to `unknown`, never `completed`. Unit tests prove
   auto-dispatch, approval gating, rejection, ambiguity, and idempotent replay.

7. Wired the real Slack (`@slack/socket-mode` + `@slack/web-api`) and Gmail
   (`googleapis`) SDKs into the connector contract: `createSlackSocketModeConnector`
   and `GmailConnector` (OAuth, poll + threaded send), with a live Slack echo
   script (`pnpm slack:echo`) and `.env.example`. Remaining is the approvals TUI.

Remaining M2 gates:

8. Exercise the live Slack echo loop against the created workspaces, then
   fault-injection tests over every commit, dispatch, delivery, and
   acknowledgement boundary in the running employee.

## M3 Kubernetes Production

Completed in the topology slice:

1. Resolved the deferred controller-versus-Helm decision with ADR 0008: Helm
   renders employee resources and organization GitOps reconciles them; no custom
   controller until GitOps cannot express required reconciliation.
2. Added the `employee-harness` chart encoding only constraints proven against the
   running image: digest-pinned image reference, one Recreate replica, read-only
   root filesystem, non-root with dropped capabilities and no privilege
   escalation, no service-account token, dedicated `$DSH_HOME` and workspace
   claims, exec-permitting in-memory `/tmp`, ClusterIP-only Web service, and a
   default-deny ingress/egress NetworkPolicy.
3. Added static chart-contract tests covering the pinned-image value contract,
   hardening stanzas, default-deny policy shape, and claim layout.

Remaining M3 gates:

1. Applied the chart on a kind cluster (v1.36 node): render-time conformance with
   Helm v4.2.4 (`helm lint` clean), image loaded into the cluster, all resources
   created, rollout healthy, and the PR #2 container checks reproduced in-pod —
   package-manager and Git executables absent, locked preset healthy and default,
   session exposes exactly the locked skill, and pod deletion recreates and
   reactivates idempotently. Conformance caught and fixed two real defects: the
   values' `image.digest` held the base-image manifest instead of the employee
   image digest, and HTTP probes cannot reach a pod IP because pinned DSH binds
   127.0.0.1 only and intentionally rejects `--host 0.0.0.0`; probes are now
   exec-based against loopback. NetworkPolicy objects apply successfully, though
   kind's default CNI does not enforce them; enforcement evidence still needs a
   policy-capable cluster.
2. Defined the OIDC proxy contract (ADR 0010) and encoded the in-pod sidecar in
   the chart: a second container sharing the pod network namespace, the only
   published port, a `STAR_UPSTREAM` loopback forward target, and a proxy-only
   Service. Remaining is exercising the sidecar on the kind cluster with a real
   proxy image and OIDC issuer.
3. Added namespace-scoped `ResourceQuota` and container `LimitRange` templates
   with a documented one-employee-per-namespace assumption (ADR 0002) and a
   disable toggle; render conformance verified for both states with Helm v4.2.4.
4. Defined the workspace broker contract (ADR 0011) and added
   `@star/employee-workspace`: a typed lease lifecycle (lease/resume/stop/release),
   a credential-free `RemoteFilesystem`/`RemoteSubprocess` provider surface, and
   lease-request validation that rejects unknown profiles, credential-bearing
   repositories, and empty task ids. The Kubernetes provider is the remaining
   implementation, plus a 64 GiB remote-task conformance run.

## M4 Temporal Workflows

Completed in the contract slice:

1. Defined the Temporal supervisory workflow boundary (ADR 0012): one workflow
   per task, idempotent Activities (`process-task`, `deliver-outbox`,
   `execute-effect`), human approvals via Signals/Updates, and effect-specific
   retry policy.
2. Added `@star/employee-workflow`: the typed workflow/activity/signal contract,
   activity idempotency-key derivation from stable operation ids, and retry
   policies that never auto-retry an ambiguous delivery or effect into a
   duplicate. Unit tests cover the mapping.

Remaining M4 gate:

3. Wire the `@temporalio/*` worker and client to the contract, add schedules and
   Continue-As-New for recurring processes, and prove a multi-step approved task
   workflow survives employee pod deletion and replacement.

## M5 Release Readiness

Completed in the gates slice:

1. Defined the release-readiness gates (ADR 0013): a CI gate running
   `pnpm check`, an MIT `LICENSE`, cosign keyless image signing, syft SBOM
   generation, backup/recovery runbooks, and a digest-pinned, Recreate-scoped
   upgrade policy.
2. Added `.github/workflows/ci.yml` and `docs/release.md` (backup schedule,
   recovery runbook, signing/SBOM steps, upgrade and rollback policy).

Remaining M5 gate:

3. Produce a signed release artifact with an attached SBOM and exercise the
   recovery runbook against a real employee pod.

## Deferred Decisions

| Topic | Decision trigger |
| --- | --- |
| Central versus per-pod connector deployment | Measure connector resource cost and organization account routing during M2. |
| Memory retrieval implementation | Define provenance, deletion, and access scenarios before choosing a vector or relational index. |
| Temporal Cloud versus self-hosted | Establish organization compliance, region, traffic, and operational ownership before M4. |
| Custom Kubernetes controller versus generated Helm resources | Resolved by ADR 0008: Helm-generated resources reconciled by GitOps; revisit only when GitOps cannot express required reconciliation. |
| A2A support | A real external agent delegation use case supplies identity, authorization, and lifecycle requirements. |

## Requirement to Evidence

| Requirement | Implementation | Current evidence | Remaining gate |
| --- | --- | --- | --- |
| EMP-001 | Recipe contracts and `star-employee recipe validate` | Unit tests, CLI integration tests, schema freshness check | None for M0 |
| EMP-002 | In progress | Capability lock schema; local/npm resolver tests; matching exact-Git/npm Harness Alchemist compiles; generated Star preset and image; explicit frozen runtime closure; idempotent activation test; frozen offline install; outbound-guarded host DSH Web RPC smoke; container-native no-network, read-only-root, non-root, executable-absence, preset/session/skill, and restart-reactivation evidence | Exact system/CLI package resolution |
| EMP-003 | Not implemented | DSH source investigation and ADR 0001 | Bridge conformance and Web visibility tests |
| EMP-004 | Not implemented | ADR 0002; ADR 0008 and hardened employee-harness chart with static contract tests | kind-cluster render/apply isolation test reproducing container checks |
| EMP-005 | Not implemented | OpenClaw/Hermes failure-path research | Connector restart and delivery fault tests |
| EMP-006 | Not implemented | ADR 0003 | Operation ledger conformance tests |
| EMP-007 | Not implemented | Architecture and ADR 0001 | OIDC and role authorization end-to-end test |
| EMP-008 | Not implemented | ADRs 0003 and 0006 | Effect and audit conformance tests |
| EMP-009 | Not implemented | ADR 0004 | Remote 64 GiB workspace integration test |
| EMP-010 | Not implemented | ADR 0005 and Temporal documentation | Pod-replacement workflow test |
| EMP-011 | Not implemented | DSH sandbox evidence and ADR 0006 | Container secret-isolation and egress tests |
| EMP-012 | Not implemented | Architecture data ownership model | Memory contract and retention tests |
