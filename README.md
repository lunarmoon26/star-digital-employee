# Star Digital Employee

Star Digital Employee is an infrastructure-as-code platform for running long-lived
AI employees in isolated containers or Kubernetes pods. Each employee has a
versioned recipe, dedicated state, explicit capabilities, supervised communication
channels, and an auditable execution history.

## Status

The project is in its foundation milestone. The implemented surface validates the
first `Employee` recipe contract. The container runtime, DeepSeek Harness bridge,
channels, durable task supervisor, remote workspaces, and Temporal integration are
accepted product behavior tracked in the [roadmap](docs/roadmap.md), but are not yet
implemented.

The repository previously shipped a Claude Code plugin marketplace. Those files
remain as migration inputs while useful prompts and skills are reviewed. They are
not the architecture or configuration model of the new product.

## Quick Start

Requirements:

- Node.js 24
- pnpm 11

Install dependencies and validate the example employee recipe:

```bash
pnpm install
pnpm star-employee recipe validate recipes/examples/research-analyst.yaml
```

Expected output:

```text
Valid Employee recipe: research-analyst (star.employee/v1alpha1)
```

Run the complete local verification:

```bash
pnpm check
```

## Documentation

| Concern | Canonical owner |
| --- | --- |
| Product behavior and requirements | [Product contract](docs/product.md) |
| System boundaries and quality strategy | [Architecture](docs/architecture.md) |
| Unimplemented milestones | [Roadmap](docs/roadmap.md) |
| Significant design rationale | [Architecture decisions](docs/decisions/README.md) |
| Exact recipe syntax | [`EmployeeRecipeSchema`](packages/contracts/src/employee-recipe.ts) and the generated [JSON Schema](schemas/employee-recipe.v1alpha1.schema.json) |
| Contribution and verification workflow | [Contributing guide](CONTRIBUTING.md) |

## Repository Layout

```text
apps/                 Executable applications, beginning with the CLI
packages/             Reusable contracts and runtime packages
schemas/              Generated, distributable machine contracts
recipes/              Example infrastructure-as-code recipes
docs/                 Product, architecture, roadmap, and decisions
plugins/              Legacy Claude plugin content awaiting migration review
external_plugins/     Legacy MCP wrappers awaiting migration review
```

## Core Direction

- DeepSeek Harness is the pinned agent execution engine, not the employee control
  plane.
- One employee pod is one trust boundary with dedicated persistent state.
- The supervisor owns channels, durable work, policy, approvals, and audit
  correlation.
- Heavy development runs in on-demand Kubernetes workspaces rather than enlarging
  the employee pod.
- Temporal coordinates durable business workflows after the core restart and
  idempotency contracts are proven.

See the [architecture](docs/architecture.md) for the complete proposed topology.

## License

The project is intended to be MIT licensed. A repository license file is tracked as
a release-readiness item in the roadmap until the copyright owner adds it.
