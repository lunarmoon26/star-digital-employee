# 0007: Compile Pinned Open Capability Artifacts

Status: Accepted
Date: 2026-08-25

## Context

An employee needs portable Agent Skills and Harness-specific runtime plugins. The
open source `skills` CLI can discover and install Agent Skills from Harness
Alchemist repositories, while Harness Alchemist npm packages expose DeepSeek
Cordis adapters through a package subpath. DeepSeek Harness can discover
`~/.agents/skills` and install npm bundles into a profile, but both locations are
mutable and may include capabilities not selected by an employee recipe.

The `skills` CLI lock also records mutable refs and does not verify its recorded
hash during restoration. Treating that lock or a shared home directory as the
deployment contract would violate recipe reproducibility and one-employee
isolation.

## Decision Drivers

- Reuse maintained open source discovery and package formats.
- Resolve every deployable capability to immutable source evidence.
- Prevent user, project, or home-directory skills from shadowing recipe skills.
- Keep package installation and source credentials out of the running employee.
- Support a Harness Alchemist project without coupling Star to its generator.

## Options Considered

### Use `skills` and DSH defaults directly

This is convenient, but `~/.agents/skills`, project roots, mutable Git refs, and
runtime package operations are not an isolated or reproducible deployment input.

### Build a Star capability registry and installer

This could enforce a custom contract but would duplicate source discovery, npm,
Git, and Agent Skills ecosystem behavior.

### Adapt open source resolvers behind a Star-owned lock

This preserves ecosystem compatibility while making Star responsible for the
smaller deployment-specific validation, hashing, and activation boundary.

## Decision

Use pinned open source tools as build-time adapters, not as the deployment source
of truth:

1. Pin `skills@1.5.23` by npm version and integrity. Resolve recipe sources to an
   exact Git commit, npm tarball integrity, or local tree digest before invoking
   it.
2. Run `skills add` non-interactively against an isolated staging directory with
   the `universal`, `copy`, and telemetry-disabled options. Never run its update or
   restore commands in a production build.
3. Validate the materialized Agent Skill names, reject duplicates and symlinks,
   and compute a canonical Star tree digest. The `skills` lock is advisory only;
   the Star recipe lock owns deployable provenance.
4. Store the selected skill set in a content-addressed, read-only runtime root.
   Derive a content-addressed Star DSH preset from the `standard` preset packed in
   the verified DSH tarball and change only its filesystem-skill row. Configure
   `includeDefaultRoots: false` and `watch: false`. The running employee does not
   load project, home, or `~/.agents/skills` roots.
5. Treat Cordis plugins as a separate npm plane. A recipe identifies an exact npm
   package version and explicit package entry. The compiler locks registry
   integrity, resolves a complete frozen profile lock with pinned pnpm and automatic
   peer installation disabled, and emits the profile patch that mounts the entry
   and selects the Star preset by default.
6. A Harness Alchemist repository may supply skills through its `skills/` tree and
   a plugin through the built npm package's `/deepseek` export. Selecting one does
   not implicitly select the other.
7. Perform all Git, npm, and skill-manager operations in a secret-free build
   environment. Runtime package installation, `dsh plugin`, floating versions,
   source URLs containing credentials, and in-place capability updates are
   prohibited. Git egress is restricted to an operator-approved host allowlist;
   the initial CLI policy permits `github.com`.

Canonical tree algorithm `star-tree-v1` visits slash-normalized paths in JavaScript
code-unit order and hashes directory/file markers, normalized `0644` or `0755` mode,
file byte length, and file bytes. Local projects are snapshotted before discovery;
`.git` and `node_modules` directories are excluded, while symlinks and special
files fail compilation. A lock-format revision is required to change this
algorithm.

Harness Alchemist remains a supported producer, not a required runtime dependency.
Any source satisfying the Agent Skills contract and any compatible Cordis npm
package may be selected.

## Consequences

- Positive: Star reuses open formats and discovery instead of operating a private
  capability marketplace.
- Positive: An employee receives exactly the capabilities named by its recipe and
  lock.
- Positive: Harness Alchemist projects work in both portable-skill and Cordis
  runtime planes.
- Negative: Star must maintain canonical tree hashing, source verification, and a
  small adapter around the upstream CLI.
- Negative: Package and skill resolution is a build operation rather than an
  immediate runtime update.
- Negative: A Cordis package must expose an entry compatible with the pinned DSH
  and Cordis versions; npm packaging alone is not proof of compatibility.

## Confirmation

- Compilation fails for floating package versions, non-commit Git revisions,
  duplicate skill names, malformed skills, symlinks, or unexpected manager output.
- Recompiling a recipe and lock in a clean environment produces the same canonical
  skill digest and profile dependency graph.
- The generated DSH preset exposes the locked skills and no project or home skills.
- Runtime smoke tests load each locked Cordis entry without package-manager access.

## Evidence Baseline

- `vercel-labs/skills` commit `435076e78988e1e6ec40d00b0b1d76bdbbc5419a`,
  tag `v1.5.23`.
- Harness Alchemist commit `f195cf478632112631536f3e46932f0f09fb3ed2`,
  tag `v0.1.8`.
- DeepSeek Harness commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`,
  tag `dsh-v0.1.1-rc.2`.
