# 0013: Release Readiness Gates

Status: Accepted
Date: 2026-08-25

## Context

M5 requires the repository to ship a verifiable release artifact with signing,
an SBOM, backups, recovery runbooks, a license, and an upgrade policy. Without
these, an operator cannot trust the image origin, reproduce provenance, or
recover a failed employee.

## Decision Drivers

- Every release artifact must be attributable and tamper-evident.
- Recovery must be runbook-driven, not tribal knowledge.
- Upgrades must be pinned and reversible.
- CI must run the same `pnpm check` gate developers run locally.

## Options Considered

### Defer all release concerns to deployment operators

This is least effort but leaves provenance and recovery unowned. Rejected.

### Hand-publish artifacts

Manual signing and SBOM generation are error-prone and not reproducible.
Rejected.

### Encode gates in CI plus runbooks

CI runs the documented check, signs images, and generates SBOMs; runbooks own
backup and recovery. Accepted.

## Decision

1. **CI gate.** `.github/workflows/ci.yml` installs pinned tooling and runs
   `pnpm check` (documentation links, schema freshness, typecheck, unit tests,
   builds) on every change.
2. **License.** The repository carries an MIT `LICENSE`.
3. **Image signing.** Release images are signed with `cosign` keyless signing
   against the OIDC identity of the release workflow; signatures are recorded
   beside the digest in the release notes.
4. **SBOM.** Each release generates a CycloneDX or SPDX SBOM with `syft` from
   the built image and attaches it to the release.
5. **Backups and recovery.** `docs/release.md` owns the backup schedule and the
   recovery runbook (employee volume restore, harness state, ledger recovery).
6. **Upgrade policy.** `docs/release.md` owns the upgrade policy: images are
   digest-pinned, upgrades are Recreate-scoped to one employee, and rollback is
   re-rendering the prior Git commit.

## Consequences

- Positive: A release is attributable, reproducible, and recoverable.
- Positive: CI and local checks cannot drift.
- Negative: Keyless signing requires the workflow's OIDC provider; SBOM and
  signing tooling are new build-time dependencies.

## Confirmation

- CI runs `pnpm check` and fails on the same conditions as a local run.
- A release attaches a cosign signature and a syft SBOM.
- `docs/release.md` documents backup, recovery, and upgrade rollback steps.
