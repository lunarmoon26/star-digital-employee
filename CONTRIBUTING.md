# Contributing

## Development Model

Development happens on `main` through focused feature or bug-fix branches. Keep
documentation, machine contracts, implementation, and evidence synchronized in
the same change.

The repository follows document-driven development:

1. Locate the canonical owner for the behavior being changed.
2. Document an accepted behavior delta before broad implementation.
3. Keep exact shapes in schemas or typed interfaces rather than prose.
4. Implement the smallest coherent slice.
5. Map requirements to automated or manual evidence.
6. Reconcile documentation when implementation reveals a real constraint.

Future work belongs in `docs/roadmap.md`. Significant, costly-to-reverse choices
belong in `docs/decisions/` and must not be hidden in implementation notes.

## Requirements

- Node.js 24
- pnpm 11

Install dependencies:

```bash
pnpm install
```

## Verification

Run all local gates:

```bash
pnpm check
```

The gate runs schema freshness, type checking, tests, and production builds. Run a
focused command while developing when appropriate:

```bash
pnpm schema:check
pnpm typecheck
pnpm test
pnpm build
```

Every command shown in changed documentation must also be run before the change is
considered complete.

## Recipe Changes

`packages/contracts/src/employee-recipe.ts` owns the source schema. The JSON Schema
under `schemas/` is a generated distribution artifact.

After changing the source schema, regenerate and verify it:

```bash
pnpm schema:generate
pnpm schema:check
```

Schema changes require:

- A product-contract update when observable behavior changes.
- Positive and negative validation tests.
- Updated examples.
- A migration decision before removing or changing an accepted field.

## Security

- Never commit credentials, tokens, private keys, or credential-bearing fixtures.
- Recipes contain references to secrets, never secret values.
- Do not add cloud, Kubernetes, channel, or provider credentials to the Harness
  process environment.
- Treat email, chat messages, web pages, and tool results as untrusted input.
- Do not weaken an approval, sandbox, egress, or audit boundary to make a test pass.

## Legacy Plugin Content

Files under `plugins/`, `external_plugins/`, and `.claude-plugin/` are migration
inputs. Changes there do not define the digital employee runtime. New runtime
capabilities belong in the application and package structure described by the
architecture.
