# Star Digital Employee Architecture

Status: Mixed. Recipe validation, capability compilation, image generation, and
DSH-state activation are implemented; supervisor and deployment sections are
accepted target architecture.

Audience: maintainers, platform operators, security reviewers, and connector or
runtime contributors

Last verified on 2026-08-25 against the capability compiler baseline `90d37ee`,
DeepSeek Harness `dsh-v0.1.1-rc.2` at `b150a55`, `skills@1.5.23` at
`435076e`, Harness Alchemist `v0.1.8` at `f195cf4`, Hermes `cd29765`, and
OpenClaw package `2026.2.24`

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
| P1 Reproducibility | A clean builder recompiles a recipe and lock. | The selected skill tree and Cordis dependency graph are byte-identical. | Canonical digests and frozen-lock installation match. |

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
Recipe compiler -> pinned source resolvers -> content-addressed capabilities
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
| Recipe compiler | Validate recipes; resolve exact images, packages, and skill sources; generate immutable locks, DSH profiles, and content-addressed runtime input. | Build cache only | CLI, JSON Schema, npm, Git, and pinned `skills` adapter |
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

## Critical Flow: Capability Compilation

1. The compiler validates unique capability IDs, exact npm versions, exact Git
   commits, credential-free URLs on an operator-approved host allowlist, and
   recipe-relative local paths. The default implementation permits `github.com`.
2. A secret-free builder materializes the exact Git tree, npm tarball, or local
   project and records its source identity. Mutable refs are never compilation
   inputs.
3. The pinned `skills@1.5.23` CLI discovers and copies each explicitly selected
   Agent Skill into an isolated universal staging root. Telemetry and prompts are
   disabled; update and restore commands are not used.
4. Star rejects symlinks, malformed DSH frontmatter, duplicate names, and unexpected
   output, then computes a `star-tree-v1` canonical digest over the complete
   selected skill tree. Local sources are first snapshotted without `.git` or
   `node_modules`.
5. The compiler derives a complete Star DSH preset from the
   `standard` preset inside the integrity-verified DSH tarball, changes only its
   filesystem-skill row, and content-address the result. Default roots and watching
   are disabled.
6. Exact Cordis package versions become profile dependencies and patch rows. DSH,
   the selected packages, and explicit support peers form one frozen runtime graph
   with automatic peer installation disabled. The compiler verifies exact direct
   versions and registry integrity before accepting that graph.
7. The capability lock records source and resolved identities, tool versions,
   integrities, skill-tree digest, runtime and profile inputs, base image, and
   generated-file digests. The upstream `skills-lock.json` is discarded as
   advisory metadata.
8. The generated multi-stage image installs the runtime graph with build-only pnpm,
   removes package-manager and Git entry points, and runs the verified entrypoint as
   a non-root user. Activation restores only managed profile and preset inputs into
   writable DSH state; resolvers and package managers are unavailable at runtime.

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
| Capability artifacts | Recipe compiler/image | Content-addressed, read-only skills and exact npm package graph |
| DSH profile activation | DeepSeek Harness on employee PVC | Generated inputs copied into writable runtime state; no dependency mutation |
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
or process isolation requires it. Kubernetes resources are generated by the
`charts/employee-harness` Helm chart and reconciled by organization GitOps; no
custom employee controller exists (ADR
[0008](decisions/0008-kubernetes-generated-resources.md)).

The Harness image uses a digest-pinned Node.js 24 base, a non-root user, a read-only
root filesystem, explicit writable mounts, dropped capabilities, no service-account
token, and default-deny egress. `@deepseek-ai/dsh` is installed at an exact version
during image build. Channel credentials are mounted only into connector containers.
The Harness receives a revocable model-gateway credential bounded to employee, model,
and budget rather than an upstream provider credential.

The image contains the generated profile dependency graph and a read-only skill
root addressed by its Star digest. A content-addressed Star Web preset configures
`@deepseek-ai/dsh-skill-filesystem` with `includeDefaultRoots: false`, the one
generated `customSkillDirs` root, and `watch: false`. Bridge-created sessions
explicitly select that preset. The writable DSH home contains runtime settings,
sessions, and generated `cordis.yml`, but no package manager, source credentials,
project skills, home skills, or mutable capability source.

Image assembly uses one frozen runtime graph containing the exact DSH package,
selected Cordis packages, and explicit exact support peers required by the pinned
DSH release. A verified standalone pnpm artifact exists only in the dependency
stage; lifecycle scripts and automatic peers are disabled. The final image removes
JavaScript, Git, and Debian package-manager entry points. Immutable runtime packages,
skills, preset templates, and lock evidence live under `/opt/star`.

The image entrypoint activates only deployment-owned inputs. It atomically restores
the named profile's manifest, patch, workspace policy, and immutable `node_modules`
link under `$DSH_HOME/profiles`, and restores the selected preset under
`$DSH_HOME/.agent-presets`. DSH continues to own generated `cordis.yml`, settings,
credentials, and session state. Activation never recursively replaces `$DSH_HOME`
and is safe to repeat against an existing employee volume.

Verified on 2026-08-25 with Docker Desktop 29.7.2: the generated research-analyst
image builds from its emitted Dockerfile and runs with `--network none`,
`--read-only`, `--cap-drop ALL`, `no-new-privileges`, and user `node`. In-container
checks confirmed npm, pnpm, Corepack, yarn, Git, apt, and dpkg are absent; DSH Web
reached readiness; the locked preset was listed healthy and default; a session on
that preset exposed exactly the locked skill; and a container restart reactivated
idempotently. Verified on 2026-08-25 with Docker Desktop 29.7.2 and a kind v1.36 cluster: the
chart applies cleanly, the pod reaches readiness with exec-based loopback probes,
and the container checks from the Docker evidence reproduce in-pod, including
idempotent reactivation after pod deletion. Pinned DSH binds DSH Web to 127.0.0.1
only and rejects `--host 0.0.0.0` by design because the Web surface is
code-execution-equivalent; the authentication proxy must therefore run as an
in-pod sidecar sharing the network namespace and forwarding to loopback (ADR
[0010](decisions/0010-web-authentication-boundary.md)). The sidecar is the only
published port. It terminates TLS and enforces OIDC (or a local-dev bearer
token), forwards `POST /api/*` and static `GET`s with `Content-Type:
application/json` preserved, upgrades the `/api/events.mux` and `/api/events.host`
WebSockets, and preserves the external `Host` authority, which DSH's trust fence
requires to equal the request `Origin`. DSH ignores `X-Forwarded-*`, so the proxy
supplies those only for its own logs and policy.

One mount requirement was discovered: pinned DSH loads native peer
bindings by materializing them into `$TMPDIR` before `dlopen`, so the writable
temporary mount must allow execution (`exec`), which default Docker tmpfs options
omit.

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
- `skills`, Git, and npm are build adapters rather than runtime control surfaces.
  Their exit status is insufficient evidence; the compiler verifies expected
  artifacts and independent digests.
- A Harness Alchemist repository's Agent Skills and npm `/deepseek` Cordis entry
  are independent selections. Neither plane implicitly activates the other.

## Decisions

- [0001: Use DeepSeek Harness behind a pinned process boundary](decisions/0001-use-deepseek-harness.md)
- [0002: Isolate one employee per pod](decisions/0002-one-employee-per-pod.md)
- [0003: Require durable inbox, outbox, and effect state](decisions/0003-durable-message-and-effect-state.md)
- [0004: Run heavy development in Kubernetes workspaces](decisions/0004-kubernetes-development-workspaces.md)
- [0005: Limit Temporal to supervisory workflows](decisions/0005-temporal-supervisory-workflows.md)
- [0006: Keep operational credentials outside Harness](decisions/0006-isolate-operational-credentials.md)
- [0007: Compile pinned open capability artifacts](decisions/0007-compile-pinned-open-capabilities.md)
- [0008: Generate Kubernetes resources with Helm before any controller](decisions/0008-kubernetes-generated-resources.md)
- [0009: Supervisor bridge protocol and operation-ID contract](decisions/0009-supervisor-bridge-protocol.md)
- [0010: Protect the DSH Web surface with an authentication proxy](decisions/0010-web-authentication-boundary.md)
- [0011: Workspace broker contract](decisions/0011-workspace-broker-contract.md)
- [0012: Temporal supervisory workflow boundary](decisions/0012-temporal-supervisory-workflow-boundary.md)
- [0013: Release readiness gates](decisions/0013-release-readiness.md)

## Risks

| Risk | Impact | Mitigation or evidence gate |
| --- | --- | --- |
| DSH preview APIs change | Bridge breakage or session corruption | Exact pin, packed-install test, bridge conformance suite, explicit upgrade ADR when boundary changes |
| Duplicate or ambiguous provider effects | Repeated email, Slack, or business mutation | Durable outbox, stable provider identity, `unknown` outcome, reconciliation |
| Prompt injection reaches ambient authority | Data loss or exfiltration | Credential isolation, egress policy, capability gateways, approval floors |
| Pod-local state is treated as centralized audit | Employee can erase accountability evidence | Independent append-only audit export and alerting |
| Temporal is introduced before operation semantics stabilize | Distributed complexity hides basic correctness defects | Complete restart/idempotency milestone first |
| Remote workspace provider becomes a privileged shell API | Cluster compromise | Typed operations, narrow broker RBAC, leases, quotas, no generic control-plane credentials |
| Open source capability tooling resolves mutable or unsafe input | Non-reproducible build or source exfiltration | Exact source identities, secret-free builder, symlink rejection, independent tree digest, frozen npm lock |

## Research Basis

- DSH plugin and event model: `../deepseek-harness/docs/architecture.md`
- DSH skills and profile implementation: `../deepseek-harness/docs/subsystems/skills.md`
- Agent Skill discovery adapter: <https://github.com/vercel-labs/skills/tree/v1.5.23>
- Universal skill and Cordis package producer:
  <https://github.com/lunarmoon26/harness-alchemist/tree/v0.1.8>
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
