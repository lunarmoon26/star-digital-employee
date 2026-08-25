# 0008: Generate Kubernetes Resources With Helm Before Any Controller

Status: Accepted
Date: 2026-08-25

## Context

M3 introduces Kubernetes production deployment: one employee pod and PVC per
employee (ADR 0002), organization services, and default-deny networking. The
roadmap deferred the choice between a custom reconciliation controller and
generated Helm resources until evidence showed continuous reconciliation could not
be handled by existing GitOps tooling. The generated Harness image and its verified
runtime constraints now exist (PR #1, PR #2): digest-pinned image, read-only root,
non-root user, dropped capabilities, no-new-privileges, default-deny egress, an
exec-permitting writable temporary mount, writable `$DSH_HOME`, and no package
managers or Git inside the container.

## Decision Drivers

- Employee declarations are already immutable recipes plus locks; desired state is
  declarative and changes rarely.
- The platform has no in-cluster operator team yet and must minimize privileged
  cluster-surface code.
- The supervisor bridge and workspace broker (M1/M2) are prerequisites for
  employee-level reconciliation logic worth encoding in a controller.
- GitOps tooling (for example Flux or Argo) already reconciles rendered manifests
  continuously.

## Options Considered

### Custom employee controller

A controller could own recipe-to-pod reconciliation, rollout ordering, and status
aggregation. This adds a privileged watch/reconcile surface that must be hardened,
tested, and operated before any of it is justified by real behavior.

### Rendered Helm resources reconciled by GitOps

Helm renders one employee's Deployment, PVC, ServiceAccount, Service, and
NetworkPolicy from the compiled recipe inputs. Continuous reconciliation comes from
existing GitOps tooling; drift correction and rollback are inherited rather than
built.

## Decision

Generate Kubernetes resources with Helm from compiled employee inputs and let
organization GitOps reconcile them. Do not build a custom employee controller in
M3. Charts encode only constraints already proven against the running image:

- Digest-pinned image reference taken from the capability lock.
- Read-only root filesystem; `allowPrivilegeEscalation: false`; all capabilities
  dropped; non-root security context.
- No service-account token automount.
- Writable `$DSH_HOME` on a dedicated PVC; workspace and temporary mounts;
  temporary storage permits execution because pinned DSH materializes native
  bindings into `$TMPDIR`.
- Default-deny ingress and egress NetworkPolicy with explicit allowlists.
- Resource limits sourced from the recipe control-pod profile.

## Consequences

- Positive: No privileged in-cluster Star code before the bridge proves what
  reconciliation actually requires.
- Positive: Every employee's desired state stays reviewable in Git as rendered
  manifests.
- Negative: Cross-resource orchestration (for example activation jobs or ordered
  rollouts) must be expressed through Helm hooks until a controller exists.
- Negative: Recipe-to-values rendering becomes a compiler responsibility and needs
  its own conformance tests.
- Follow-up: Revisit a controller when evidence shows GitOps cannot express a
  required reconciliation behavior, most likely around workspace brokers or
  session-aware failover after M2 lands.

## Confirmation

- The chart renders successfully from the example recipe's compiled lock.
- A kind-cluster smoke applies the rendered manifest and reproduces the
  container-native runtime checks from PR #2.
- Drift applied to a live object is reverted by GitOps reconciliation without
  manual intervention.
