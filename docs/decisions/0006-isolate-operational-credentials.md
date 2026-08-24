# 0006: Keep Operational Credentials Outside Harness

Status: Accepted
Date: 2026-08-24

## Context

DeepSeek Harness filesystem providers permit reads in every sandbox mode, and its
local process sandbox does not restrict network access. Untrusted channel content
can influence model-controlled tool calls. Placing Slack, Google, cloud, cluster,
or upstream model credentials in Harness-readable environment variables or files
therefore creates ambient authority and an exfiltration path.

## Decision Drivers

- Bound the effect of prompt injection and compromised tools.
- Let each connector enforce its own narrow identity and delivery contract.
- Keep cloud and cluster control credentials out of the agent execution world.
- Preserve independent credential rotation and audit.

## Options Considered

### Rely on DSH environment scrubbing and write confinement

This reduces accidental subprocess leakage but does not prevent arbitrary file
reads or unrestricted network use.

### Keep credentials in dedicated services and connector containers

This adds processes but exposes only typed, scoped capabilities to the employee.

## Decision

Channel credentials are mounted only into connector containers. Kubernetes and
cloud credentials remain in a workspace broker or control-plane service. Upstream
model credentials remain in a model gateway; DSH receives only a revocable,
employee-scoped token restricted by model and budget. Network policy allows Harness
egress only to approved gateways and dependencies.

## Consequences

- Positive: Harness compromise does not directly reveal organization-wide
  operational credentials.
- Positive: Capability, budget, rotation, and audit policy become enforceable at
  stable service boundaries.
- Negative: Connectors, model gateways, and workspace brokers become availability
  dependencies.
- Negative: A scoped token can still be abused within its scope and requires rate
  limits and anomaly detection.
- Follow-up: Never represent sidecar placement alone as a security boundary without
  secret mounts, process isolation, dropped capabilities, and egress policy.

## Confirmation

- Container tests prove Harness cannot read connector, cloud, cluster, or upstream
  provider credentials.
- Network tests prove Harness cannot reach unapproved external destinations.
- Audit identifies the employee-scoped credential or workload identity used for
  each external request without recording the secret.
