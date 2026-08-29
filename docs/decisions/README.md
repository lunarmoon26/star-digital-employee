# Architecture Decisions

Decision records preserve why significant choices were accepted. The
[architecture](../architecture.md) owns the current target structure; these files
own rationale and consequences.

| Decision | Status |
| --- | --- |
| [0001: Use DeepSeek Harness behind a pinned process boundary](0001-use-deepseek-harness.md) | Accepted |
| [0002: Isolate one employee per pod](0002-one-employee-per-pod.md) | Accepted |
| [0003: Require durable message and effect state](0003-durable-message-and-effect-state.md) | Accepted |
| [0004: Run heavy development in Kubernetes workspaces](0004-kubernetes-development-workspaces.md) | Accepted |
| [0005: Limit Temporal to supervisory workflows](0005-temporal-supervisory-workflows.md) | Accepted |
| [0006: Keep operational credentials outside Harness](0006-isolate-operational-credentials.md) | Accepted |
| [0007: Compile pinned open capability artifacts](0007-compile-pinned-open-capabilities.md) | Accepted |
| [0008: Generate Kubernetes resources with Helm before any controller](0008-kubernetes-generated-resources.md) | Accepted |
| [0009: Supervisor bridge protocol and operation-ID contract](0009-supervisor-bridge-protocol.md) | Accepted |
| [0010: Protect the DSH Web surface with an authentication proxy](0010-web-authentication-boundary.md) | Accepted |
| [0011: Workspace broker contract](0011-workspace-broker-contract.md) | Accepted |
| [0012: Temporal supervisory workflow boundary](0012-temporal-supervisory-workflow-boundary.md) | Accepted |
| [0013: Release readiness gates](0013-release-readiness.md) | Accepted |
| [0014: Outcome verification and escalation](0014-outcome-verification-and-escalation.md) | Accepted |
