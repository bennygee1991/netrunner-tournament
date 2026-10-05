# Development

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL + Prisma 7 (`@prisma/adapter-pg`) ·
own session auth (argon2id, DB sessions) · zod · Vitest · Playwright (+ axe-core).
Decisions and rule interpretations: [DECISIONS.md](DECISIONS.md). Product spec: [SPEC.md](SPEC.md).

## Quick start

Requirements: Node 22+, pnpm 10, Docker (or any local PostgreSQL 16).

```bash
pnpm install
cp .env.example .env          # set ADMIN_PASSWORD (10+ chars)
docker compose up -d          # Postgres with `circuit` and `circuit_test` databases
pnpm db:migrate               # apply migrations
pnpm db:seed                  # first admin from ADMIN_RUNNER_NAME / ADMIN_PASSWORD
pnpm db:demo                  # optional: an archived + a live season of demo data
pnpm dev                      # http://localhost:3000
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm lint` | ESLint + Prettier check (`pnpm format` to fix) |
| `pnpm typecheck` | Route type generation + `tsc` |
| `pnpm test` | Vitest: engine, differential test vs the prototype, DB integration tests (need `TEST_DATABASE_URL`) |
| `pnpm e2e` | Playwright on a production build against `TEST_DATABASE_URL` (wiped first), incl. accessibility scans |
| `pnpm db:migrate` / `db:migrate:dev` | Apply / create migrations |
| `pnpm db:seed` | Create the first admin (no-op if one exists) |
| `pnpm db:demo` | Demo data for an empty local database |
| `pnpm db:restore <file>` | Restore a JSON backup into an empty database |
| `pnpm admin:reset-password "<name>"` | Emergency temporary password for an account |
| `pnpm vercel-build` | What Vercel runs: generate, migrate, seed, build |

`pnpm test` and `pnpm e2e` share `circuit_test` and both wipe it.

## Layout

- `src/engine/`: the pure tournament engine (Swiss, sides, tiebreaks, cut, points, boards, season). No DB or framework imports; ESLint enforces this. Ported from `reference/prototype.html`.
- `tests/engine/differential.test.ts`: runs the prototype's own JavaScript and the engine side by side on random events and asserts identical behaviour.
- `src/lib/tournament/`: DB ⇄ engine mapping (`state.ts`), admin operations with version checks and audit (`ops.ts`), registration, seasons, resets, boards, profiles, queries.
- `src/lib/auth/`: sessions, accounts, rate limits, admin checks.
- `src/lib/rules-content.ts`: Rules page text built from engine constants (tested).
- `src/lib/guides.ts` + `src/components/markdown.tsx`: Guides wiki (Markdown via react-markdown, raw HTML never rendered, revisions kept).
- `src/app/`: pages, server actions and route handlers. Every admin action calls `adminActor()` (origin check + admin role).
- `prisma/`: schema, migrations, seed. `scripts/`: demo data, restore, password reset.

## Conventions

- Validate all input with zod in the service layer. Server actions are thin wrappers.
- Every admin change writes an `AuditLog` row; destructive ones need typed confirmation.
- Keep the Rules page in sync: change `src/engine/rules.ts` and `src/lib/rules-content.ts` together.
- Before committing: `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`.

## Next milestone

None planned. If the league ever wants official-style cuts: double elimination (NSG Organized Play
Policies 1.1.11.2-1.1.11.4). The league's own cut is the single-elimination series format.
