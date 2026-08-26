# 0011: Workspace Broker Contract

Status: Accepted
Date: 2026-08-25

## Context

Heavy development can require 64 GiB memory or specialized hardware, but the
employee control pod must stay lightweight. ADR 0004 decided that Git remains the
source of truth and that a workspace broker provisions on-demand Kubernetes
execution worlds from named, policy-approved resource profiles, exposing only
typed filesystem and subprocess providers to DeepSeek Harness.

M3 now needs the exact broker surface so the provider can be implemented and
conformance-tested without coupling DSH to Kubernetes.

## Decision Drivers

- The broker is a typed service boundary, not a generic shell or credential
  passthrough.
- Leases bound cost: compute stops on completion or idle and volumes follow
  retention policy.
- DSH must never receive Kubernetes or cluster credentials (ADR 0006).
- The contract must be testable with a fake broker, before a Kubernetes provider
  exists.

## Options Considered

### Give DSH a Kubernetes client

This is the smallest surface but grants cluster authority to a code-execution
runtime. Rejected.

### Expose a generic remote shell

A generic shell is flexible but inauditable and hard to quota. Rejected.

### Typed lease + remote filesystem/subprocess providers

The broker owns leases and quotas; DSH sees only a narrow read/write/subprocess
surface. Accepted.

## Decision

Define the workspace broker as a typed contract with three parts:

1. **Lease lifecycle.** `lease(request)` validates the named execution profile,
   a credential-free repository, and the requested size, then provisions a
   PVC-backed workspace with one task worktree and returns a
   `WorkspaceLease`. `resume` re-attaches an existing lease; `stop` releases
   compute but retains the worktree; `release` applies retention policy and
   releases the volume; `list` enumerates live leases.
2. **Provider surface.** A workspace exposes a `RemoteFilesystem` (read, write,
   list, stat, remove within the worktree) and a `RemoteSubprocess` (spawn,
   signal, kill, wait). Neither carries credentials or cluster access.
3. **Isolation.** The broker validates the repository URL (credential-free
   HTTPS, no credentials or query), bounds resource sizes against the resolved
   profile, and never accepts or returns Kubernetes credentials. SSH is a
   break-glass human path, not part of the contract.

The recipe's `spec.execution.profiles` already names the resource profiles; the
broker resolves a profile by reference and refuses an unknown or oversized one.

## Consequences

- Positive: The employee pod and development compute scale and authorize
  independently.
- Positive: The broker can be faked in unit tests and swapped for a Kubernetes
  or managed-workspace provider later.
- Negative: The remote filesystem and subprocess providers must preserve
  cancellation, exit codes, and file semantics well enough to replace a local
  shell.
- Negative: Volume retention, Git reconciliation, and backup policy remain
  provider-side concerns.

## Confirmation

- `lease` rejects an unknown profile, a credential-bearing repository, and a
  size exceeding the resolved profile.
- A lease transitions `provisioning → ready → stopped → released` and `resume`
  re-attaches a `stopped` lease.
- The provider surface contains no Kubernetes or cluster credential type.
