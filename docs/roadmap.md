# Implementation Roadmap

Status: Proposed sequencing for accepted product behavior

This document owns unimplemented work and delivery order. It does not override the
product contract, exact schemas, or accepted architecture decisions.

## Milestones

| Milestone | Status | Scope | Exit gate |
| --- | --- | --- | --- |
| M0 Contract foundation | Implemented | Canonical documentation, initial ADRs, TypeScript workspace, recipe schema, validation CLI | Documented valid and invalid recipe workflows pass `pnpm check`. |
| M1 Harness core | In progress | Runtime image, locked open capabilities, generated DSH profile and preset, owner-only supervisor bridge, local Docker topology | A supervisor-created ordinary session uses only locked skills and plugins and is visible, resumable, and cancellable in DSH Web. |
| M2 Durable employee | Proposed | Transactional inbox/outbox/task/effect ledger, Slack Socket Mode, Gmail API connector, approvals, TUI | Restart and fault-injection tests prove accepted messages are not lost and terminal operations are not duplicated. |
| M3 Kubernetes production | Proposed | Helm deployment, PVC, OIDC proxy, NetworkPolicy, quotas, workspace broker, remote DSH providers | A 64 GiB task runs remotely while the employee pod retains normal limits and credentials remain isolated. |
| M4 Temporal workflows | Proposed | Temporal worker, schedules, Signals/Updates, heartbeat Activities, workflow cancellation | A multi-step approved task survives employee pod deletion and replacement. |
| M5 Release readiness | Proposed | CI, image signing, SBOM, backups, recovery runbooks, license, upgrade policy | Release artifact and disaster-recovery evidence satisfy documented gates. |

## M1 Harness Core

Completed in the capability-compilation slice:

1. Extended the recipe with exact local, Git, and npm Agent Skill sources plus
   exact npm Cordis package entries.
2. Pinned `skills@1.5.23` as a build adapter and independently validated and hashed
   its selected output.
3. Added a capability lock, content-addressed skill root, exact profile dependency
   manifest, and Cordis patch rows. Exact Git and npm forms of the public Harness
   Alchemist artifact produce the same selected skill digest.
4. Derived a content-addressed Star preset from the integrity-verified DSH package
   with one locked skill root, default roots disabled, and watching disabled.
5. Generated and validated the frozen pnpm v9 profile graph with pinned pnpm,
   automatic peer installation disabled, exact direct integrity, and integrity for
   every transitive registry package. The real Harness Alchemist graph passes a
   frozen offline install from a prefetched store.

The next slice adds the runtime boundary needed to prove DeepSeek Harness ownership:

1. Build a pinned Node.js 24 Harness image and activate generated inputs into a
   writable DSH home without runtime package-manager access.
2. Implement the bounded Unix-socket bridge as an opt-in DSH bundle.
3. Create, prompt, observe, cancel, and cold-resume bridge-owned sessions while
   explicitly selecting the generated Star preset.
4. Protect the DSH Web surface with a local development authentication mode and a
   production OIDC proxy contract.
5. Test browser and supervisor concurrency against one session.

Durable channel work starts only after the bridge operation-ID contract is proven.

## Deferred Decisions

| Topic | Decision trigger |
| --- | --- |
| Central versus per-pod connector deployment | Measure connector resource cost and organization account routing during M2. |
| Memory retrieval implementation | Define provenance, deletion, and access scenarios before choosing a vector or relational index. |
| Temporal Cloud versus self-hosted | Establish organization compliance, region, traffic, and operational ownership before M4. |
| Custom Kubernetes controller versus generated Helm resources | Add a controller only when continuous reconciliation cannot be handled by existing GitOps tooling. |
| A2A support | A real external agent delegation use case supplies identity, authorization, and lifecycle requirements. |

## Requirement to Evidence

| Requirement | Implementation | Current evidence | Remaining gate |
| --- | --- | --- | --- |
| EMP-001 | Recipe contracts and `star-employee recipe validate` | Unit tests, CLI integration tests, schema freshness check | None for M0 |
| EMP-002 | In progress | Capability lock schema; local/npm resolver tests; real `skills@1.5.23` adapter; matching exact-Git/npm Harness Alchemist compiles; generated Star preset; validated frozen profile lock; real frozen offline package install | Image assembly, writable activation, and no-network DSH runtime skill/plugin test |
| EMP-003 | Not implemented | DSH source investigation and ADR 0001 | Bridge conformance and Web visibility tests |
| EMP-004 | Not implemented | ADR 0002 | Kubernetes isolation test |
| EMP-005 | Not implemented | OpenClaw/Hermes failure-path research | Connector restart and delivery fault tests |
| EMP-006 | Not implemented | ADR 0003 | Operation ledger conformance tests |
| EMP-007 | Not implemented | Architecture and ADR 0001 | OIDC and role authorization end-to-end test |
| EMP-008 | Not implemented | ADRs 0003 and 0006 | Effect and audit conformance tests |
| EMP-009 | Not implemented | ADR 0004 | Remote 64 GiB workspace integration test |
| EMP-010 | Not implemented | ADR 0005 and Temporal documentation | Pod-replacement workflow test |
| EMP-011 | Not implemented | DSH sandbox evidence and ADR 0006 | Container secret-isolation and egress tests |
| EMP-012 | Not implemented | Architecture data ownership model | Memory contract and retention tests |
