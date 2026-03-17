# Docker Compose Reference Guide

> **Purpose:** This document is the authoritative reference for managing Docker
> Compose configurations across environments in this repository.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [File Structure](#file-structure)
3. [Environment Strategy](#environment-strategy)
   - [Override Files (Primary)](#override-files-primary)
   - [`.env` Files (Value Interpolation)](#env-files-value-interpolation)
   - [Profiles (Service Toggling)](#profiles-service-toggling)
4. [Usage Commands](#usage-commands)
5. [Writing & Modifying Compose Files](#writing--modifying-compose-files)
6. [Invariants & Lint Rules](#invariants--lint-rules)
7. [Troubleshooting](#troubleshooting)
8. [Further Reading](#further-reading)

---

## Core Principles

These principles are **non-negotiable**. They are enforced in CI and should
guide every change to Compose configuration.

| #   | Principle                                                                                                                                                                                               | Rationale                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | **Single source of truth.** All shared service definitions live in `compose.yaml`.                                                                                                                      | Prevents drift between environments. Agents and humans read the same base file.                                    |
| 2   | **Layered overrides, not forks.** Environment-specific differences are expressed as thin override files, never as full copies.                                                                          | Reduces duplication. Makes diffs between environments immediately visible.                                         |
| 3   | **Values in `.env`, structure in YAML.** If only a value changes (image tag, replica count, password), use `.env` interpolation. If the service graph or volume topology changes, use an override file. | Keeps override files small and reviewable.                                                                         |
| 4   | **Profiles for optional services.** Services that exist only in certain environments (debug tooling, monitoring stacks) use Compose profiles.                                                           | Avoids conditional logic or commented-out blocks.                                                                  |
| 5   | **Everything is version-controlled.** No Compose configuration may live outside this repository.                                                                                                        | Agents cannot reason about what they cannot see ([ref](https://openai.com/zh-Hans-CN/index/harness-engineering/)). |
| 6   | **Validate at boundaries.** All external inputs (env vars, mounted secrets) must be validated at container entry points. Parse, don't guess.                                                            | Prevents silent misconfiguration across environments.                                                              |

---

## File Structure

```
project-root/
├── compose.yaml                # Base — shared service definitions
├── compose.override.yaml       # Dev overrides (auto-loaded by `docker compose up`)
├── compose.prod1.yaml          # Prod1 overrides
├── compose.prod2.yaml          # Prod2 overrides
│
├── .env.dev                    # Dev variable values
├── .env.prod1                  # Prod1 variable values
├── .env.prod2                  # Prod2 variable values
│
├── docs/
│   └── references/
│       └── compose.md          # ← You are here
│
└── scripts/
    ├── compose-up.sh           # Wrapper: selects files + env by $ENV
    └── compose-lint.sh         # CI: validates Compose files
```

> **Convention:** Override files are named `compose.<environment>.yaml`.
> Environment variable files are named `.env.<environment>`. No other naming
> scheme is permitted.

---

## Environment Strategy

### Override Files (Primary)

Docker Compose natively supports **layered configuration**. A base file defines
shared structure; thin override files layer environment-specific changes on top.

#### `compose.yaml` — Base (shared across all environments)

```yaml
# compose.yaml — DO NOT put environment-specific values here.
services:
  app:
    image: myapp:${APP_TAG:-latest}
    restart: unless-stopped
    depends_on:
      - db
    environment:
      - NODE_ENV=${NODE_ENV:-development}

  db:
    image: postgres:16
    volumes:
      - db-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=${POSTGRES_DB:-app}

volumes:
  db-data:
```

#### `compose.override.yaml` — Dev (auto-loaded)

```yaml
# compose.override.yaml — Auto-merged when you run `docker compose up`
# without explicit -f flags. Dev-only configuration goes here.
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - .:/app # Live reload
    environment:
      - DEBUG=true

  db:
    ports:
      - "5432:5432" # Expose DB for local tooling
    environment:
      - POSTGRES_PASSWORD=devpassword
```

#### `compose.prod1.yaml` — Production Variant 1

```yaml
# compose.prod1.yaml — Thin override for prod1.
services:
  app:
    environment:
      - DATABASE_URL=${DATABASE_URL}
    deploy:
      replicas: ${REPLICAS:-3}
    # No build context — uses pre-built image from registry.

  db:
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
    # Port NOT exposed — no external DB access in production.
```

#### `compose.prod2.yaml` — Production Variant 2

```yaml
# compose.prod2.yaml — Thin override for prod2.
services:
  app:
    environment:
      - DATABASE_URL=${DATABASE_URL}
    deploy:
      replicas: ${REPLICAS:-5}

  db:
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
```

> **Key behavior:** `compose.override.yaml` is automatically loaded alongside
> `compose.yaml` when you run `docker compose up` without `-f`. When you use
> `-f` explicitly, **only the specified files** are loaded.

---

### `.env` Files (Value Interpolation)

Use `.env` files when the **structure** is identical and only **values** differ.

```ini
# .env.dev
APP_TAG=dev
NODE_ENV=development
POSTGRES_DB=app_dev
DATABASE_URL=postgres://dev:dev@db:5432/app_dev
REPLICAS=1
```

```ini
# .env.prod1
APP_TAG=v2.1.0
NODE_ENV=production
POSTGRES_DB=app_prod
DATABASE_URL=postgres://user:pass@db-prod1:5432/app_prod
REPLICAS=3
```

```ini
# .env.prod2
APP_TAG=v2.1.0
NODE_ENV=production
POSTGRES_DB=app_prod
DATABASE_URL=postgres://user:pass@db-prod2:5432/app_prod
REPLICAS=5
```

> **Rule:** Never commit real secrets to `.env` files. Production secrets must
> use Docker secrets, a vault, or CI-injected variables. `.env.prod*` files in
> this repo contain **non-secret defaults and references only**.

---

### Profiles (Service Toggling)

Use [Compose Profiles](https://docs.docker.com/compose/profiles/) to include or
exclude entire services per environment.

```yaml
# In compose.yaml — profile-gated services
services:
  # ... (app, db as above) ...

  debug-tools:
    image: busybox
    profiles: ["dev"]
    # Only started when COMPOSE_PROFILES includes "dev"

  monitoring:
    image: prom/prometheus
    profiles: ["prod"]

  log-collector:
    image: fluent/fluentd
    profiles: ["prod"]

  # Observability stack (agent-readable, per OpenAI's practice of giving
  # agents full local observability)
  local-metrics:
    image: victoriametrics/victoria-metrics
    profiles: ["dev", "observability"]
    ports:
      - "8428:8428"
```

---

## Usage Commands

### Quick Reference

```bash
# ─── Development ────────────────────────────────────────────────
# Auto-loads: compose.yaml + compose.override.yaml + .env.dev
docker compose --env-file .env.dev up

# With dev profile (includes debug-tools)
COMPOSE_PROFILES=dev docker compose --env-file .env.dev up

# ─── Production 1 ──────────────────────────────────────────────
docker compose \
  -f compose.yaml \
  -f compose.prod1.yaml \
  --env-file .env.prod1 \
  --profile prod \
  up -d

# ─── Production 2 ──────────────────────────────────────────────
docker compose \
  -f compose.yaml \
  -f compose.prod2.yaml \
  --env-file .env.prod2 \
  --profile prod \
  up -d

# ─── Validate (dry run) ────────────────────────────────────────
docker compose -f compose.yaml -f compose.prod1.yaml --env-file .env.prod1 config

# ─── Teardown ───────────────────────────────────────────────────
docker compose down --volumes --remove-orphans
```

### Wrapper Script

For convenience and CI consistency, use the provided wrapper:

```bash
# scripts/compose-up.sh
#!/usr/bin/env bash
set -euo pipefail

ENV="${1:?Usage: compose-up.sh <dev|prod1|prod2>}"

case "$ENV" in
  dev)
    COMPOSE_PROFILES=dev \
    docker compose --env-file .env.dev up "$@"
    ;;
  prod1)
    docker compose \
      -f compose.yaml -f compose.prod1.yaml \
      --env-file .env.prod1 --profile prod \
      up -d "${@:2}"
    ;;
  prod2)
    docker compose \
      -f compose.yaml -f compose.prod2.yaml \
      --env-file .env.prod2 --profile prod \
      up -d "${@:2}"
    ;;
  *)
    echo "Unknown environment: $ENV" >&2
    echo "Valid options: dev, prod1, prod2" >&2
    exit 1
    ;;
esac
```

---

## Writing & Modifying Compose Files

### For Agents (Codex / Copilot)

When creating or modifying Compose configuration, follow this checklist:

1. **Start from `compose.yaml`.** Read the base file first. Understand the
   existing service graph before making changes.
2. **Never duplicate base definitions.** Override files must contain **only**
   the keys that differ. Do not copy unchanged fields.
3. **Use variable interpolation with defaults.** Every `${VAR}` reference in
   YAML must include a default: `${VAR:-default_value}`.
4. **Add comments explaining _why_, not _what_.** The YAML keys explain what;
   comments explain intent.
5. **Run validation after changes:**
   ```bash
   docker compose -f compose.yaml -f compose.<env>.yaml --env-file .env.<env> config
   ```
6. **Update this document** if you add a new environment, service, or profile.

### For Humans

- Review override files by diffing against `compose.yaml` — the delta should
  be small and obvious.
- When adding a new environment (e.g., `staging`), create both
  `compose.staging.yaml` and `.env.staging`, then add a case to
  `scripts/compose-up.sh`.
- Prefer **profiles** over override files when the only difference is whether a
  service is present or absent.

---

## Invariants & Lint Rules

These are enforced in CI via `scripts/compose-lint.sh`. Violations will block
merge.

| Rule                                                  | Check                                           | Error Code    |
| ----------------------------------------------------- | ----------------------------------------------- | ------------- |
| No hardcoded secrets in YAML                          | Regex scan for `password:`, `secret:`, API keys | `COMPOSE-001` |
| All `${VAR}` must have defaults                       | Parse all interpolations                        | `COMPOSE-002` |
| Override files must not redefine `volumes:` top-level | Structural check                                | `COMPOSE-003` |
| Every service in an override must exist in base       | Cross-file validation                           | `COMPOSE-004` |
| `.env.*` files must not contain production secrets    | Pattern match                                   | `COMPOSE-005` |
| Override files must be ≤ 50 lines                     | File length check                               | `COMPOSE-006` |
| All Compose files must pass `docker compose config`   | Dry-run validation                              | `COMPOSE-007` |

> **Philosophy:** Enforce invariants, not implementation details. The rules
> above define boundaries; within them, agents and humans have freedom in how
> they express solutions.
> ([ref: OpenAI Harness Engineering — "constrain boundaries, allow local autonomy"](https://openai.com/zh-Hans-CN/index/harness-engineering/))

---

## Troubleshooting

| Symptom                       | Likely Cause                                                    | Fix                                                                  |
| ----------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| Dev starts with prod config   | Ran `docker compose -f ...` which skips `compose.override.yaml` | Use `docker compose up` (no `-f`) for dev, or use the wrapper script |
| `variable is not set` warning | Missing `.env` file or missing default in `${VAR}`              | Add `:-default` to interpolation or pass `--env-file`                |
| Service not starting          | Profile not activated                                           | Add `--profile <name>` or set `COMPOSE_PROFILES=<name>`              |
| Port conflict                 | Another environment's containers still running                  | Run `docker compose down` on the previous environment first          |
| Override not applying         | Typo in service name (must match base exactly)                  | Compare service names between base and override files                |

---

## Further Reading

- [Docker Compose: Multiple Compose Files](https://docs.docker.com/compose/multiple-compose-files/)
- [Docker Compose: Environment Variables](https://docs.docker.com/compose/environment-variables/)
- [Docker Compose: Profiles](https://docs.docker.com/compose/profiles/)
- [Parse, Don't Validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)

---

_This document is maintained as a living reference. If you modify Compose
conventions, update this file in the same PR. A doc-gardening agent
periodically verifies freshness._
