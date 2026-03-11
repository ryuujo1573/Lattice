# Bun

This repository uses Bun as the package manager and JavaScript runtime.

## Policy

- Use Bun for dependency installation and running scripts.
- Do not introduce npm/yarn/pnpm workflows unless explicitly required.
- Keep `bun.lock` committed and up to date.

## Common Commands

- Install dependencies: `bun install`
- Run a script: `bun run <script>`
- Execute a file: `bun <file>`
- Run tests: `bun test`
- Run one-off tools: `bunx <tool> ...`

## Notes

- If you add or change dependencies, ensure lockfile updates are included in the same change.
- When documenting “how to run” steps in `docs/`, prefer Bun commands.
