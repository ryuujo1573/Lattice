# AGENTS

This file is the map injected into agent context. Keep it short and stable.

The harness is the product: stable commands + mechanical checks + a repository-local knowledge base. Put durable knowledge in `docs/`, not here.

## System of Record

`docs/` is the system of record for everything an agent must reliably know. If `docs/` does not exist yet, create it rather than expanding `AGENTS.md`.

## Where to Look (Progressive Disclosure)

Start from the smallest entry point and follow links:

- [`docs/index.md`](./docs/index.md): knowledge table of contents and status
- [`docs/architecture/`](./docs/architecture/): domains, boundaries, dependency rules
- [`docs/design-docs/`](./docs/design-docs/): design documentation and core beliefs
- [`docs/quality/`](./docs/quality/): coding standards, reliability/performance budgets
- [`docs/security/`](./docs/security/): security rules, threat model, secrets handling
- [`docs/runbooks/`](./docs/runbooks/): debugging and operational playbooks
- [`docs/evals/`](./docs/evals/): verification scenarios, metrics, golden tests
- [`docs/exec-plans/`](./docs/exec-plans/): execution plans (`active/`, `completed/`) and tech debt tracker
- [`docs/references/`](./docs/references/): curated external references (tools, frameworks, APIs)
- [`docs/generated/`](./docs/generated/): agent-readable derived artifacts (schemas, catalogs)

## Work Interface (Context Pack)

When asking an agent to do work, provide a minimal context pack:

- Goal: one-sentence outcome
- Acceptance: how to verify (tests/evals) and expected signals
- Constraints: compatibility, performance, security, scope
- Pointers: links into `docs/` + 1–3 code entry points
- Evidence: repro steps, logs, traces, failing tests, current diff

## Hard Constraints

- If a rule matters, encode it in code/tests/linters/CI rather than prose.
- Every change must have a cheap, repeatable verification path.
- Any reusable knowledge discovered during work must be written to `docs/`.

## Repo Map

- `packages/lattice/`: core domain package
- `packages/robot/`: automation package(s)
- `packages/adapters/`: integration packages
- `examples/`: example configurations and usage

## Definition of Done

- Acceptance criteria met and verified by a runnable check.
- Guardrails updated when new invariants are introduced.
- `docs/` updated when new knowledge is created.
