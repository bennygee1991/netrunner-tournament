# Netrunner Circuit: project instructions

## What this is
A web app for a Netrunner tournament league. Players register with a **runner name (their username)**
and a password, sign up for events, and follow Swiss + top-cut brackets and leaderboards.
One admin (the organizer) runs everything.

## Stack (change only if you tell the owner why)
- Next.js (App Router) + TypeScript, Tailwind CSS
- PostgreSQL + Prisma (local Postgres via docker-compose)
- Auth: own implementation with Auth.js Credentials or iron-session. Passwords hashed with argon2id.
  HttpOnly, Secure, SameSite=Lax session cookies. No JWTs in localStorage.
- Tests: Vitest for the tournament engine, Playwright for the main flows
- Deploy target: Vercel + Neon (confirm with the owner before provisioning anything)

## Rules of the repo
- The tournament engine (`src/engine/`) is pure TypeScript with no DB or framework imports. Everything in
  `docs/SPEC.md` section 4 must have unit tests. Port logic from `reference/prototype.html`, do not guess.
- All admin routes and server actions check the admin role on the server. Never trust the client.
- Validate every input with zod. Rate-limit login and register. Generic error on bad login.
- Runner names: 3-24 chars, letters/digits/space/_/-, unique case-insensitively, shown with the original casing.
- Never log passwords or session tokens. Never commit secrets. `.env.example` only.
- Destructive admin actions (reset season, reset all) require typed confirmation and write an AuditLog row.
- Mobile first. Most players use phones. Dark cyberpunk look; light theme via prefers-color-scheme.
- Small commits, conventional messages. Run lint, typecheck and tests before each commit.

## Commands (create these scripts)
`pnpm dev` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm e2e`

## Netrunner rules source
Null Signal Games Organized Play Policies v1.6.2 and the FFG Android: Netrunner tournament rules.
Summary is in `docs/SPEC.md` section 4 and on the in-app Rules page.

## Next.js version notes
@AGENTS.md
