# Domain-Driven Design (DDD)

This document defines a Domain-Driven Design blueprint for Lattice. It is intentionally repository-local and agent-friendly: it describes boundaries, language, and dependency rules that should be enforced mechanically over time.

## Goals

- Keep the system legible to agents and humans through explicit boundaries and a stable knowledge base.
- Make change safe by encoding invariants as runnable checks rather than prose.
- Enable parallel development by separating business rules from integrations and delivery mechanisms.

## Ubiquitous Language

These terms should be used consistently in code, docs, and tests.

- Harness: the control system that turns intent into verified changes (docs + scripts + checks + evals).
- Plan (Execution Plan): a versioned artifact that tracks progress and decisions for a complex change.
- Eval: a runnable scenario that verifies a user journey, constraint, or invariant.
- Adapter: an integration boundary to external systems (APIs, auth, infra, storage).
- Signal: evidence produced by running the system (logs, metrics, traces, snapshots, recordings).
- Agent Run: a single agent-driven attempt to complete a task with a context pack and feedback loop.

## Strategic Design

### Bounded Contexts

This monorepo is organized around bounded contexts at the package level.

- **Lattice Core** (`packages/lattice/`)
  - Purpose: the core domain model and application workflows.
  - Owns: ubiquitous language, domain rules, and the stable public API.
  - Does not own: environment-specific integrations and delivery details.

- **Robot** (`packages/robot/`)
  - Purpose: automation and agent-facing workflows (running tasks, wiring evals, producing signals).
  - Owns: orchestration logic, task execution pipelines, and integration of verification loops.
  - Depends on: Lattice Core (as the source of domain truth).

- **Adapters** (`packages/adapters/*`)
  - Purpose: integrations with external systems (e.g., ByteDance infra).
  - Owns: credentials handling patterns, network boundaries, SDK wrappers, and protocol translation.
  - Exposes: implementations behind explicit ports/contracts defined by Lattice Core or Robot.

### Context Map (High-Level)

- Robot → uses Lattice Core application services to execute workflows.
- Lattice Core → defines ports (interfaces) for integrations it requires.
- Adapters → implement those ports and remain replaceable.

The key rule: domain meaning lives in Core; external meaning is translated at the boundary.

## Tactical Design

### Layering Model (Inside a Bounded Context)

Within a package, keep dependencies flowing inward:

- **Domain**
  - Entities, Value Objects, Aggregates, Domain Events, Domain Services.
  - Pure business rules and invariants.

- **Application**
  - Use cases and orchestration of domain behavior.
  - Transaction boundaries, idempotency, and workflow coordination.

- **Infrastructure**
  - IO implementations: persistence, network clients, queues, file system, telemetry exporters.
  - Adapters belong here when implemented inside a context; otherwise live under `packages/adapters/`.

- **Interfaces (Delivery)**
  - CLI, HTTP, UI, and any interaction layer.
  - Mapping from input/output DTOs to application commands and results.

### Dependency Rules

- Domain must not depend on infrastructure or delivery code.
- Application can depend on domain, and on domain-defined ports.
- Infrastructure can depend on domain/application (to implement ports), but never the reverse.
- Interfaces depend on application (and domain types if needed), but must not contain domain rules.

### Ports and Adapters

When Lattice Core needs an integration:

- Define a port in Core (an interface + data contracts).
- Implement the port in an adapter package.
- Bind the implementation in composition root code (Robot or a delivery layer).

This keeps core logic testable and integrations replaceable.

## Architecture for Agent Legibility

DDD boundaries must be discoverable and enforceable.

- Discoverable: keep a short map in `AGENTS.md` and detailed knowledge in `docs/`.
- Enforceable: encode dependency rules with lint/structural tests and keep violations impossible to merge.
- Verifiable: add eval scenarios that exercise representative workflows across contexts.

## Repository Mapping (Current and Target)

Current top-level structure:

- `packages/lattice/`: Lattice Core bounded context
- `packages/robot/`: automation/orchestration bounded context
- `packages/adapters/*`: adapter bounded contexts

Target internal structure (per package):

```
src/
  domain/
  application/
  infrastructure/
  interfaces/
tests/
```

As code appears, document concrete module boundaries under `docs/architecture/` and enforce them mechanically.

## Implementation Guide

For concrete TypeScript implementation patterns using the Effect library, see [FP-DDD with Effect](../design-docs/fp-ddd-with-effect.md).

## Evolution Rules

- When a new domain term is introduced, add it to Ubiquitous Language and use it consistently.
- When a boundary is violated repeatedly, promote the rule into tooling (lint/tests/CI).
- When a workflow matters to users, encode it as an eval with runnable verification.
