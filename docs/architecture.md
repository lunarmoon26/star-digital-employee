# Star Digital Employee Architecture

Status: Mixed. Recipe validation is implemented; runtime and deployment sections
are accepted target architecture.

Audience: maintainers, platform operators, security reviewers, and connector or
runtime contributors

Last verified against: repository `f8145e7`, DeepSeek Harness
`dsh-v0.1.1-rc.2` at `b150a55`, Hermes `cd29765`, and OpenClaw package
`2026.2.24` on 2026-08-24

## Purpose and Scope

Star Digital Employee turns a versioned employee declaration into a supervised,
long-running agent runtime. It owns configuration, lifecycle, durable work,
channel delivery, policy, audit, and remote execution. DeepSeek Harness remains the
agent execution engine and direct command portal.

The first deployment targets one organization using Kubernetes in production and
Docker locally. Each pod is a trust boundary, not a tenant multiplexing boundary.

## Quality Scenarios and Constraints

| Priority | Context and stimulus | Observable response | Measure |
| --- | --- | --- | --- |
| P0 Durability | A process or pod stops at any message-processing boundary. | Accepted work resumes from durable state and effects retain explicit outcome. | Restart and fault-injection tests cover every commit boundary. |
| P0 Security | Untrusted channel content attempts to obtain ambient credentials or unauthorized effects. | Harness lacks ambient authority and policy denies effects outside the recipe. | Secret-isolation and egress tests pass. |
| P0 Accountability | A supervisor investigates an external action. | Correlated audit facts reconstruct who initiated, allowed, executed, and observed the action. | Every external mutation satisfies the audit event schema. |
| P1 Cost | A development task requires 64 GiB memory. | Remote compute scales independently and terminates when idle. | Employee pod limits remain unchanged. |
| P1 Evolvability | DeepSeek Harness introduces a breaking release. | A pinned bridge conformance suite detects incompatibility before deployment. | No Harness upgrade bypasses the suite. |

Hard constraints:

- DeepSeek Harness is in developer preview and must be pinned exactly.
- DSH filesystem tools permit reads from all container paths; secrets cannot be
  placed where the Harness container can read them.
- DSH local sandbox policy restricts file effects but not network access; cluster
  egress policy and scoped proxies provide the network boundary.
- A DSH JSONL session has one live writer.
- Temporal retries are at-least-once for Activities; downstream effects require
  idempotency or reconciliation.

## System Context

```text
GitOps repository
  Employee recipe + lock
            |
            v
Control plane / reconciler ---- OIDC, secrets, audit, telemetry
            |
            v
Employee pod
  connector host -> supervisor -> DSH bridge -> DeepSeek Harness
                         |                           |
                         v                           v
                   durable ledger               DSH session log
                         |
                         v
                  workspace broker -> on-demand Kubernetes workspace

Temporal joins the supervisor boundary after the core durable slice.
```

## Building Blocks

| Building block | Responsibility | Owned state | Primary interface |
| --- | --- | --- | --- |
| Recipe compiler | Validate source recipes and resolve immutable locks and deployment input. | No runtime state | CLI and JSON Schema |
| Control plane | Reconcile employee declarations into isolated workloads and organization policy. | Desired and observed deployment state | Kubernetes API |
| Connector host | Authenticate providers, normalize inbound events, and perform scoped delivery without exposing credentials. | Provider cursors and delivery metadata | Authenticated local protocol |
| Supervisor | Route events, own task state, schedule work, enforce operation idempotency, and coordinate responses. | Inbox, outbox, tasks, approvals, effects | Local API and DSH bridge client |
| DSH supervisor bridge | Create, prompt, resume, observe, and cancel bridge-owned ordinary DSH sessions. | Ownership and operation registry | Owner-only Unix socket |
| DeepSeek Harness | Run model turns, tools, skills, sessions, and the direct Web UI. | Append-only session logs and Harness settings | Bridge and authenticated Web proxy |
| Policy and effect gateway | Apply capability, budget, approval, target, and idempotency rules to external effects. | Effect and decision records | Tool and connector gateway APIs |
| Workspace broker | Lease isolated resource-sized execution worlds without granting DSH Kubernetes credentials. | Workspace leases | Typed service API |
| Audit pipeline | Persist immutable action facts and operational correlation. | Audit ledger and exported telemetry | Structured events and OTLP |
| Temporal worker | Coordinate durable business workflows, timers, and human signals. | Temporal workflow history | Temporal task queue |

## Critical Flow: Channel Message

1. The connector verifies provider identity and assigns a stable provider event ID.
2. The supervisor commits a canonical inbound envelope before provider
   acknowledgement.
3. A deterministic route maps organization, account, channel, thread, and sender
   to one bridge-owned DSH session.
4. The supervisor submits one idempotent prompt operation through the Unix socket.
5. DSH records model-visible input and tool events in its normal session log.
6. External mutations pass through policy, approval, and effect recording.
7. The supervisor commits an outbound obligation before connector delivery.
8. The connector records the provider message ID or an explicit ambiguous outcome.
9. Audit and telemetry export the same task, operation, session, and trace IDs.

## Critical Flow: Remote Development

1. Policy resolves a named execution profile from the locked employee recipe.
2. The workspace broker validates quota, budget, repository, and requested size.
3. The broker creates or resumes a PVC-backed workspace with one task worktree.
4. DSH accesses the workspace through a typed remote filesystem and subprocess
   provider; it does not receive Kubernetes credentials.
5. Workspace compute stops on completion or idle timeout while the Git branch,
   artifacts, and retained volume follow explicit retention policy.
6. SSH is a break-glass human path, not the orchestration protocol or source of
   truth.

## Data Ownership

| Data | Owner | Durability and access rule |
| --- | --- | --- |
| Recipe source | Git | Human-reviewed, no secret values |
| Recipe lock | Recipe compiler/Git | Immutable dependency and configuration identities |
| Harness transcript | DeepSeek Harness | Dedicated PVC, one live writer, retention policy |
| Task and delivery state | Supervisor ledger | Transactional, restart-safe, idempotency indexed |
| Working repository | Workspace provider | Git remote is canonical; PVC retains active work |
| Artifacts | Artifact store or employee PVC | Content-addressed with task provenance |
| Organizational memory | Memory provider | Provenance, retention, and access policy required |
| Audit facts | Central audit store | Append-only, redacted, independently retained |
| Operational telemetry | OpenTelemetry backend | Content capture disabled by default |

## Deployment

The local profile uses Docker Compose. Production uses one Kubernetes pod and PVC
per employee plus shared organization services. The proposed pod contains separate
Harness, supervisor, connector, and authentication-proxy containers where secret
or process isolation requires it.

The Harness image uses Node.js 24, a non-root user, read-only root filesystem,
explicit writable mounts, dropped capabilities, no service-account token, and
default-deny egress. `@deepseek-ai/dsh` is installed at an exact version during
image build. Channel credentials are mounted only into connector containers. The
Harness receives a revocable model-gateway credential bounded to employee, model,
and budget rather than an upstream provider credential.

## Cross-Cutting Rules

- Unknown configuration fields fail validation.
- Secrets are referenced, never embedded in recipes, logs, audit payloads, command
  arguments, or Harness-readable files.
- General runtime environment values resolve from named non-secret configuration
  references and an explicit safe-name allowlist; operational credentials use
  dedicated capability references and are not modeled as arbitrary environment
  values.
- Every accepted input and external effect has a stable operation ID.
- Ambiguous effect outcomes remain `unknown` until reconciled.
- Operational telemetry, immutable audit, and model transcripts are distinct data
  products with different retention and sensitivity.
- Audit records action facts and concise rationale, not hidden model reasoning.
- Dynamic third-party code does not execute in the supervisor trust domain.
- Runtime package installation is disabled; image and lock generation resolve
  executable dependencies before deployment.

## Decisions

- [0001: Use DeepSeek Harness behind a pinned process boundary](decisions/0001-use-deepseek-harness.md)
- [0002: Isolate one employee per pod](decisions/0002-one-employee-per-pod.md)
- [0003: Require durable inbox, outbox, and effect state](decisions/0003-durable-message-and-effect-state.md)
- [0004: Run heavy development in Kubernetes workspaces](decisions/0004-kubernetes-development-workspaces.md)
- [0005: Limit Temporal to supervisory workflows](decisions/0005-temporal-supervisory-workflows.md)
- [0006: Keep operational credentials outside Harness](decisions/0006-isolate-operational-credentials.md)

## Risks

| Risk | Impact | Mitigation or evidence gate |
| --- | --- | --- |
| DSH preview APIs change | Bridge breakage or session corruption | Exact pin, packed-install test, bridge conformance suite, explicit upgrade ADR when boundary changes |
| Duplicate or ambiguous provider effects | Repeated email, Slack, or business mutation | Durable outbox, stable provider identity, `unknown` outcome, reconciliation |
| Prompt injection reaches ambient authority | Data loss or exfiltration | Credential isolation, egress policy, capability gateways, approval floors |
| Pod-local state is treated as centralized audit | Employee can erase accountability evidence | Independent append-only audit export and alerting |
| Temporal is introduced before operation semantics stabilize | Distributed complexity hides basic correctness defects | Complete restart/idempotency milestone first |
| Remote workspace provider becomes a privileged shell API | Cluster compromise | Typed operations, narrow broker RBAC, leases, quotas, no generic control-plane credentials |

## Research Basis

- DSH plugin and event model: `../deepseek-harness/docs/architecture.md`
- DSH sandbox limits: `../deepseek-harness/packages/fs/fs-sandbox/README.md`
  and `../deepseek-harness/packages/shell/bash-sandbox/README.md`
- Temporal Activity idempotency and heartbeat guidance:
  <https://docs.temporal.io/activity-definition>
- MCP tool security requirements:
  <https://modelcontextprotocol.io/specification/2026-07-28/server/tools>
- OpenTelemetry GenAI conventions:
  <https://opentelemetry.io/docs/specs/semconv/gen-ai/>
- NIST software and AI agent identity concept paper:
  <https://www.nccoe.nist.gov/sites/default/files/2026-02/accelerating-the-adoption-of-software-and-ai-agent-identity-and-authorization-concept-paper.pdf>
