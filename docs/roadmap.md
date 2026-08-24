# Implementation Roadmap

Status: Proposed sequencing for accepted product behavior

This document owns unimplemented work and delivery order. It does not override the
product contract, exact schemas, or accepted architecture decisions.

## Milestones

| Milestone | Status | Scope | Exit gate |
| --- | --- | --- | --- |
| M0 Contract foundation | Implemented | Canonical documentation, initial ADRs, TypeScript workspace, recipe schema, validation CLI | Documented valid and invalid recipe workflows pass `pnpm check`. |
| M1 Harness core | Proposed | Runtime image, generated DSH profile, owner-only supervisor bridge, local Docker topology | A supervisor-created ordinary session is visible, resumable, and cancellable in DSH Web. |
| M2 Durable employee | Proposed | Transactional inbox/outbox/task/effect ledger, Slack Socket Mode, Gmail API connector, approvals, TUI | Restart and fault-injection tests prove accepted messages are not lost and terminal operations are not duplicated. |
| M3 Kubernetes production | Proposed | Helm deployment, PVC, OIDC proxy, NetworkPolicy, quotas, workspace broker, remote DSH providers | A 64 GiB task runs remotely while the employee pod retains normal limits and credentials remain isolated. |
| M4 Temporal workflows | Proposed | Temporal worker, schedules, Signals/Updates, heartbeat Activities, workflow cancellation | A multi-step approved task survives employee pod deletion and replacement. |
| M5 Capability migration | Proposed | Review and migrate research/developer skills, MCP connectors, skill provenance and quarantine | Runtime no longer depends on Claude marketplace metadata. |
| M6 Release readiness | Proposed | CI, image signing, SBOM, backups, recovery runbooks, license, upgrade policy | Release artifact and disaster-recovery evidence satisfy documented gates. |

## Next Slice: Harness Core

The next implementation slice adds only the boundary needed to prove DeepSeek
Harness ownership:

1. Compile an `Employee` recipe into a local runtime layout.
2. Build a pinned Node.js 24 Harness image and writable DSH home.
3. Implement the bounded Unix-socket bridge as an opt-in DSH plugin.
4. Create, prompt, observe, cancel, and cold-resume bridge-owned sessions.
5. Protect the DSH Web surface with a local development authentication mode and a
   production OIDC proxy contract.
6. Test browser and supervisor concurrency against one session.

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
| EMP-002 | Not implemented | Schema reserves source recipe concepts | Lock schema, resolver, reproducibility test |
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

## Legacy Content Disposition

The `researcher` methodology is the first migration candidate. Developer language
guidance requires technical review and executable example tests before migration.
The sample and marketplace-scaffolding plugins have no target runtime role. DeepWiki
is reconsidered as an authenticated MCP connector rather than copied as a Claude
wrapper.
