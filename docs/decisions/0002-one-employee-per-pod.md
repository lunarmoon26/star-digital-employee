# 0002: Isolate One Employee Per Pod

Status: Accepted
Date: 2026-08-24

## Context

Employees have different identities, tools, memory, connectors, budgets, and
failure domains. OpenClaw and Hermes use logical agent separation inside trusted
processes, but their plugin and channel runtimes are not hostile multi-tenant
security boundaries.

## Decision Drivers

- Make the security boundary match the employee identity and configuration.
- Limit the blast radius of prompt injection, plugin failure, and resource use.
- Allow independent deployment, suspension, backup, and upgrade.
- Preserve a single live writer for DSH session persistence.

## Options Considered

### Multiplex employees inside one gateway

This lowers idle cost but shares credentials, plugin code, memory, process failure,
and policy enforcement.

### One employee per pod

This costs more baseline resources but maps identity, storage, resource limits, and
operations to a concrete isolation boundary.

## Decision

Run one employee per pod, persistent volume, workload identity, and configuration
digest. Multiple containers may separate Harness, supervisor, connectors, and
authentication inside that pod. Mutually untrusted organizations require separate
namespaces or stronger infrastructure boundaries.

## Consequences

- Positive: Failure, storage, identity, and resource ownership are explicit.
- Positive: DSH sessions retain one process owner.
- Negative: Many employees create many workloads and increase baseline cost.
- Negative: Pod isolation does not remove the need for connector process separation
  and network policy.
- Follow-up: Measure idle cost before selecting autosuspension behavior.

## Confirmation

- Deployment generation creates one workload identity and PVC per employee.
- Resource quotas and network policies are applied per employee namespace or label.
- No deployment mounts another employee's state.
