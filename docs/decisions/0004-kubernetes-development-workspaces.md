# 0004: Run Heavy Development in Kubernetes Workspaces

Status: Accepted
Date: 2026-08-24

## Context

Routine employee work needs modest resources, while code development and validation
can require 64 GiB memory or specialized hardware. Permanently sizing every
employee pod for peak development is expensive. A dedicated SSH host provides
continuity but weak lifecycle, quota, and audit semantics.

## Decision Drivers

- Keep long-running employee control runtimes lightweight.
- Allocate large resources only while needed.
- Preserve project work independently of compute lifetime.
- Avoid giving model-controlled processes cluster credentials.

## Decision

Git remains source of truth. A workspace broker provisions on-demand Kubernetes
execution worlds from named, policy-approved resource profiles. Project working
copies live on retained volumes and concurrent tasks use separate worktrees or
branches. DSH accesses workspaces through typed filesystem and subprocess provider
contracts. SSH is break-glass human access only.

## Consequences

- Positive: Control-plane cost and development compute scale independently.
- Positive: Quotas, leases, idle shutdown, and provenance are enforceable.
- Negative: Remote filesystem, terminal, cancellation, and artifact behavior need a
  robust provider implementation.
- Negative: Persistent volumes and Git state require reconciliation and backup
  policy.
- Follow-up: The first provider targets Kubernetes; the interface may later support
  E2B or managed workspace services.

## Confirmation

- A `development-large` task receives 64 GiB without changing employee pod limits.
- Stopping compute preserves the configured working state and releases compute.
- DSH and its subprocesses cannot read Kubernetes credentials.
