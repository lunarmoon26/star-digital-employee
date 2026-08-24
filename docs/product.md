# Digital Employee Product Contract

Status: Accepted, with implementation status recorded per requirement

This document owns externally observable product behavior. Exact configuration
syntax belongs to machine-readable schemas, architecture rationale belongs to
decision records, and unimplemented sequencing belongs to the roadmap.

## Current Baseline and Problem

The repository at tag `v0.3.0` is a static Claude Code plugin marketplace. Claude
Code supplies execution, models, tools, state, permissions, and interaction. The
repository contains no service process, container, durable queue, authenticated
Web application, or deployment contract.

The product needs independently operating employees that process routine work over
long periods, remain inspectable by a human supervisor, and can temporarily access
larger remote compute without making every employee pod expensive.

## Outcome

An organization declares each employee through a versioned recipe. The platform
runs that employee in an isolated pod, receives work through approved channels,
executes agent turns through DeepSeek Harness, records actions and policy decisions,
and exposes supervised Web and terminal control surfaces.

## Goals

- Reproducible employee configuration through reviewable infrastructure as code.
- Durable task, delivery, approval, and audit state across process or pod failure.
- Explicit identities, capabilities, budgets, and resource boundaries.
- Slack, Google Workspace, Web, and terminal interaction.
- Lightweight employee pods with on-demand Kubernetes development workspaces.
- Harness-independent control contracts so the execution engine can be upgraded or
  replaced deliberately.

## Non-Goals

- Hostile multi-tenant isolation inside one employee process or pod.
- Exactly-once execution of arbitrary third-party effects.
- A custom general-purpose workflow language.
- Permanent high-resource development machines for every employee.
- A2A interoperability before cross-organization delegation is required.
- Preserving Claude marketplace compatibility as a runtime constraint.

## Requirements

| ID | Status | Requirement |
| --- | --- | --- |
| EMP-001 | Implemented | The CLI validates a versioned `Employee` recipe and rejects unknown fields, malformed values, and inline credential fields. |
| EMP-002 | Accepted | A recipe resolves to an immutable lock containing exact image, Harness, plugin, skill, and system-package identities without containing secret values. |
| EMP-003 | Accepted | DeepSeek Harness owns model turns, tool execution, skills, sessions, and the direct Web experience behind a narrow supervisor bridge. |
| EMP-004 | Accepted | One employee runs as one pod trust boundary with dedicated persistent state and workload identity. |
| EMP-005 | Accepted | Slack and Google Workspace connectors durably accept inbound events before acknowledgement and durably record outbound intent before delivery. |
| EMP-006 | Accepted | Every accepted operation has a stable idempotency key and terminal `completed`, `failed`, `cancelled`, or `unknown` state. |
| EMP-007 | Accepted | Human supervisors access Harness Web and terminal sessions through authenticated, authorized control surfaces. |
| EMP-008 | Accepted | External mutations pass through policy and approval checks and produce an immutable audit record correlated with the task and Harness session. |
| EMP-009 | Accepted | Heavy development runs in resource-sized Kubernetes workspaces while the employee control pod remains within its normal resource profile. |
| EMP-010 | Accepted | Temporal coordinates multi-step workflows, durable timers, and approvals after core delivery and idempotency behavior is proven without Temporal. |
| EMP-011 | Accepted | Channel, cloud, workspace, and upstream model credentials are not readable by Harness tools or model-controlled subprocesses. |
| EMP-012 | Accepted | Employee memory distinguishes Harness transcript, durable task state, working files, artifacts, and provenance-bearing organizational memory. |

## Recipe Validation Contract

Status: Implemented

The `star-employee recipe validate <path>` command accepts YAML or JSON. It returns
success only when the complete document satisfies the current `Employee` schema.
Validation is strict: unknown fields fail rather than being ignored. Parse and
schema failures are written to standard error and return a non-zero exit status.

Recipes identify secrets through named references such as `accountRef` and
`gatewayRef`. Inline credential value fields are not part of the schema and fail
strict validation. Runtime environment variables resolve through named non-secret
configuration references; literal environment values are invalid. `v1alpha1`
allows only `LOG_LEVEL`, `TZ`, `LANG`, and `NO_COLOR`. The generated JSON Schema
validates structural constraints. The CLI also validates cross-field profile
references, tool policy conflicts, and package uniqueness. Runtime resolution of a
non-secret configuration reference is an M1 evidence gate and is not claimed by
the current validator.

### Acceptance Criteria

- Given the checked-in example, validation prints its employee name and API version
  and exits zero.
- Given an unknown field at any defined object boundary, validation reports that
  field and exits non-zero.
- Given an inline `apiKey` field, validation rejects the recipe.
- Given malformed YAML or JSON, validation reports a parse failure without a stack
  trace.
- Given a stale generated JSON Schema, the schema freshness gate fails.

## System Acceptance Scenarios

| ID | Stimulus | Observable response | Evidence target |
| --- | --- | --- | --- |
| ACC-001 | The pod stops after durable inbox acceptance and before Harness dispatch. | The replacement pod resumes the same operation without accepting a duplicate terminal result. | Restart integration test |
| ACC-002 | A channel delivery times out after the provider may have accepted it. | Delivery settles as `unknown` and is reconciled rather than reported as success. | Fault-injection test |
| ACC-003 | Untrusted email asks the agent to reveal credentials. | Harness cannot read channel, cloud, Kubernetes, or upstream provider credentials. | Container security test |
| ACC-004 | A task selects the `development-large` profile. | A 64 GiB remote workspace handles execution while the employee pod retains its normal limits. | Kubernetes integration test |
| ACC-005 | An external mutation completes. | Audit storage contains actor, task, operation, policy, approval, target, result, trace, and configuration digest. | Audit conformance test |
| ACC-006 | A supervisor opens the direct Harness portal. | Organization authentication and supervisor authorization are required. | End-to-end authorization test |

## Compatibility and Migration

The marketplace release remains available through Git history and existing tags.
There is no runtime compatibility promise between Claude marketplace manifests and
the `Employee` recipe. Reusable prompt content is migrated only after review and
tests identify its Harness-native behavior.

## Evidence Map

The current requirement-to-evidence map lives in the
[roadmap](roadmap.md#requirement-to-evidence). It records missing evidence rather
than treating accepted behavior as implemented.
