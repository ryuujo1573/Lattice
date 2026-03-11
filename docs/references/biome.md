# Biome (Linting & Formatting)

Biome is the preferred tool for linting and formatting.

## Run

Biome is installed as a root devDependency and invoked via Bun scripts:

- Check (lint + format + imports): `bun run check`
- Fix (apply safe fixes): `bun run check:fix`
- Format only: `bun run format` / `bun run format:fix`
- Lint only: `bun run lint` / `bun run lint:fix`

## Configuration

- Biome config file: `biome.json` (or `biome.jsonc`) at repository root.
- Prefer a single root config for the monorepo unless a package needs an override.

## Upgrading Biome

When upgrading a major/minor version:

- Read Biome’s recent posts and release notes to understand breaking changes and migrations:
  - Blog: https://biomejs.dev/blog/
  - Releases: https://github.com/biomejs/biome/releases
- Update `biome.json` only as needed for compatibility (avoid config churn).
- Run `bun run check:fix`, then `bun run check` to confirm a clean state.
- Review formatting diffs and ensure CI matches local behavior.
