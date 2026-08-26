# Star Digital Employee

Star Digital Employee is an infrastructure-as-code platform for running long-lived
AI employees in isolated containers or Kubernetes pods. Each employee has a
versioned recipe, dedicated state, explicit capabilities, supervised communication
channels, and an auditable execution history.

## Status

The contract foundation is implemented and the Harness core milestone is in
progress. The current surface validates the `Employee` recipe and compiles its
pinned Agent Skills and Cordis package entries into a deterministic capability
lock, frozen DSH runtime graph, generated image, profile, and preset. Idempotent
activation and an outbound-guarded host DSH Web smoke are implemented. The
supervisor bridge (an owner-only Unix-socket DSH plugin with an operation-id
contract) is implemented and runtime-proven against a live Harness — including a
real `session/prompt` turn through a mock model with idempotent replay across a
DSH restart — and the Web authentication boundary (ADR 0010) is defined and
encoded in the chart. The durable supervisor ledger (a SQLite inbox/outbox/task/
effect/approval ledger with operation-id idempotency and `unknown` ambiguity
semantics), the supervisor state machine (deterministic routing, idempotent
prompt submission, outbound commitment, crash recovery), the connector host with
a Slack Socket Mode adapter (commit-before-acknowledge, outbox delivery), and the
effect gateway (approval-gated external mutations with `unknown` ambiguity), the
workspace broker contract (typed lease lifecycle with a credential-free provider
surface), and the Temporal workflow contract (task workflows with idempotent
Activities) are implemented and unit-tested. Release readiness (MIT license, CI
gate, signing/SBOM/backup/upgrade docs) is defined. Provider SDK wiring, the
approvals TUI, the Kubernetes workspace and Temporal worker providers, and the
signed-release conformance remain tracked in the [roadmap](docs/roadmap.md).

## Quick Start

Requirements:

- Node.js 24
- pnpm 11
- Docker, only when building the generated image

Install dependencies and validate the example employee recipe:

```bash
pnpm install
pnpm star-employee recipe validate recipes/examples/research-analyst.yaml
```

Expected output:

```text
Valid Employee recipe: research-analyst (star.employee/v1alpha1)
```

Compile the immutable Harness inputs and run the host runtime smoke:

```bash
pnpm star-employee recipe compile recipes/examples/research-analyst.yaml \
  --output .star/research-analyst
pnpm runtime:smoke .star/research-analyst
```

The smoke prefetches the frozen graph, installs it offline without lifecycle
scripts, removes the build-only package manager, blocks non-loopback Node TCP
connections, and checks the generated preset and exact skill catalog through DSH
Web RPC. Build the same artifact as an image when Docker is available:

```bash
docker build --file .star/research-analyst/image/Dockerfile \
  --tag star-research-analyst:local .star/research-analyst
```

Run the static, unit, schema, documentation, and build verification:

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
| Exact capability-lock syntax | [`CapabilityLockSchema`](packages/contracts/src/capability-lock.ts) and the generated [JSON Schema](schemas/capability-lock.v1alpha1.schema.json) |
| Contribution and verification workflow | [Contributing guide](CONTRIBUTING.md) |

## Repository Layout

```text
apps/                 Executable applications, beginning with the CLI
packages/             Reusable contracts and runtime packages
schemas/              Generated, distributable machine contracts
recipes/              Example infrastructure-as-code recipes
charts/               Kubernetes deployment charts for employee runtimes
docs/                 Product, architecture, roadmap, and decisions
```

## Core Direction

- DeepSeek Harness is the pinned agent execution engine, not the employee control
  plane.
- Pinned open source tools discover build-time capabilities; the Star recipe lock
  and content-addressed runtime layout remain the deployment authority.
- One employee pod is one trust boundary with dedicated persistent state.
- The supervisor owns channels, durable work, policy, approvals, and audit
  correlation.
- Heavy development runs in on-demand Kubernetes workspaces rather than enlarging
  the employee pod.
- Temporal coordinates durable business workflows after the core restart and
  idempotency contracts are proven.

See the [architecture](docs/architecture.md) for the complete proposed topology.

## License

The project is MIT licensed. See [LICENSE](LICENSE) and the
[release-readiness contract](docs/release.md).
