You are building "Netrunner Circuit", a full-stack web app for a Netrunner tournament league.

Read these first, in order: CLAUDE.md, docs/SPEC.md, then reference/prototype.html (a working single-file
prototype whose tournament logic you must port faithfully into a tested TypeScript engine).

Goal: a production-ready app in this repo with a real backend, real accounts (the username IS the player's
runner name, plus a password), a separate register page and login page, and an admin area for the organizer.

How to work:
1. Start in plan mode. Summarize the plan against the 7 milestones in docs/SPEC.md section 8, list any
   questions or decisions I need to make (hosting, email reset yes/no, domain), and wait for my go-ahead.
2. Then build milestone by milestone. After each milestone: run lint, typecheck, unit tests and e2e tests,
   fix failures, commit with a clear message, and give me a short status.
3. Port the engine from the prototype into src/engine with Vitest tests covering: Swiss pairing with no
   rematches, bye rules, side assignment (single and double sided), scoring, SoS and extended SoS, cut seeding
   and cut side rules, event points, leaderboards, season archive and reset, restart round, late add, drop.
4. Build the admin tools exactly as listed in docs/SPEC.md section 5, enforced on the server, with typed
   confirmation on destructive actions and an audit log.
5. Security: argon2id, rate limiting, CSRF, secure cookies, zod validation, no secrets in git.
6. Make it mobile first, dark cyberpunk theme (cyan and magenta accents, monospaced details), with a light
   theme via prefers-color-scheme.
7. Provide docker-compose for local Postgres, .env.example, a seed script for the first admin, and a README
   that an organizer with no coding background can follow to deploy and back up the site.

Do not invent Netrunner rules. If something is unclear, check the NSG Organized Play Policies v1.6.2 and ask me.
Keep the in-app Rules page in sync with the engine behaviour.
