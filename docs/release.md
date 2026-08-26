# Release, Backup, and Recovery

Status: Release-readiness contract (ADR 0013). Owns the operator-facing gates
for shipping and recovering a Star Digital Employee.

## Build and verification

The single source of truth is `pnpm check`: documentation links, schema
freshness, TypeScript, the unit-test suite, and all package builds. CI runs the
same command (`.github/workflows/ci.yml`), so local and CI gates cannot drift.

## Image signing

Release images are signed keylessly with cosign, attributing the signature to
the GitHub Actions OIDC identity of the release workflow:

```sh
cosign sign \
  --yes \
  <registry>/star-research-analyst@<digest>
```

Signatures are recorded beside the digest in the release notes. Operators verify
with `cosign verify` before pulling.

## Software bill of materials

Each release generates an SBOM from the built image and attaches it to the
release:

```sh
syft <registry>/star-research-analyst@<digest> -o cyclonedx-json > sbom.cdx.json
```

The SBOM covers the frozen runtime graph (`pnpm-lock.yaml`), the base image, and
the compiled capability artifacts.

## Upgrade policy

- Employee images are digest-pinned; a release never mutates an existing tag.
- The `employee-harness` chart uses a `Recreate` deployment, so an upgrade stops
  one employee pod before starting its replacement.
- Rollback is re-rendering the prior Git commit's chart values and reconciled
  image digest; it does not require a code change.

## Backup

- `$DSH_HOME` (harness state, sessions, bridge token/registry/operation ledger)
  and the workspace claim are the durable employee state and are backed up on
  the organization PVC backup schedule.
- The supervisor ledger is a SQLite file under `$DSH_HOME`; its WAL is flushed
  before snapshot by stopping writes or checkpointing.

## Recovery runbook

1. **Employee pod failed.** Re-render the prior chart values and apply; the
   Recreate strategy replaces the pod, and the PVC restores employee state.
2. **Supervisor ledger corrupt.** Restore the ledger SQLite file from the latest
   snapshot; replay incomplete inbox rows with `reconcile()`; ambiguous outbox
   and effect rows stay `unknown` until explicit reconciliation.
3. **Harness session log torn.** The JSONL backend truncates only a torn final
   record and synthetic-closes an interrupted turn on next load; restart the
   employee to trigger recovery.
4. **Bridge socket stale.** The bridge removes only a socket it owns and probes
   a pre-existing socket before unlink; a dead socket is cleared on boot.
5. **Credential rotated.** Rotate the connector credential in its secret mount;
   the connector reloads it without changing the ledger or session history.

## License

The repository is MIT-licensed (`LICENSE`).
