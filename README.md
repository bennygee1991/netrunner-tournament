# Netrunner Circuit

League and tournament site for Netrunner: player accounts (username = runner name), event sign-up,
Swiss + top-cut events, two monthly leaderboards plus a season board, prizing and full resets.

> Status: under construction (milestone 2 of 7: accounts done). A full organizer guide for deploying and backing up
> the site arrives in milestone 7.

## Developer quick start

Requirements: Node 22+, pnpm 10, Docker (or any local PostgreSQL 16).

```bash
pnpm install
cp .env.example .env          # then set ADMIN_PASSWORD
docker compose up -d          # local Postgres with `circuit` and `circuit_test` databases
pnpm db:migrate               # create tables
pnpm db:seed                  # create the first admin from ADMIN_RUNNER_NAME / ADMIN_PASSWORD
pnpm dev                      # http://localhost:3000
```

## Commands

| Command          | What it does                                              |
| ---------------- | --------------------------------------------------------- |
| `pnpm dev`       | Run the site locally                                      |
| `pnpm lint`      | ESLint + Prettier check                                   |
| `pnpm typecheck` | TypeScript check                                          |
| `pnpm test`      | Vitest unit tests (DB tests run if `TEST_DATABASE_URL` set) |
| `pnpm e2e`       | Playwright end-to-end tests against `TEST_DATABASE_URL`    |
| `pnpm db:migrate`| Apply database migrations                                 |
| `pnpm db:seed`   | Create the first admin (no-op if one exists)              |

## Project layout

- `src/engine/`: pure TypeScript tournament engine (no DB/framework imports, enforced by ESLint)
- `src/app/`: Next.js App Router pages and route handlers
- `src/lib/`: server helpers (DB, auth, validation)
- `prisma/`: schema, migrations, seed
- `tests/`: e2e (Playwright) and test helpers
- `docs/SPEC.md`: product spec · `docs/DECISIONS.md`: decisions log
