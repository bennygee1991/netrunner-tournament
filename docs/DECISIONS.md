# Decisions log

Owner-approved decisions (2026-10-03):

| Topic | Decision |
| --- | --- |
| Hosting | Vercel (app) + Neon (Postgres). Owner provisions accounts by following the README; nothing is provisioned by Claude. |
| Email | None: no notifications, no email reset (owner: lower cost). Admin issues one-time temporary passwords. Email field stays optional. |
| Domain | Free `*.vercel.app` address to start; custom domain can be added later. |
| Backups | Admin "Download backup" (JSON, restorable with `pnpm db:restore`) + nightly `pg_dump` GitHub Action, **encrypted with a passphrase** (artifacts of public repos are downloadable by any GitHub user), kept 90 days + Neon restore points. |
| Rate limiting | Postgres-backed fixed-window buckets (`RateLimit` table); no extra service. |
| Time zone | Configurable via `APP_TIMEZONE` (default UTC). |
| Sessions | Own implementation: random 256-bit token in an HttpOnly/Secure/SameSite=Lax cookie; SHA-256 of the token stored in `Session`. 30-day sliding expiry. Revoked on password change / disable. |
| Runner names | ASCII letters, digits, space, `_`, `-` (3-24). ASCII-only avoids look-alike Unicode impersonation. |
| Prisma | 7.10 (latest stable; 8.x is still a release candidate), `prisma-client` generator + `@prisma/adapter-pg`. |
| Fonts | System font stacks (no build-time font download). |
| Deploy | Vercel runs `vercel-build`: prisma generate, migrate deploy (via `DIRECT_URL`), idempotent admin seed, next build. Cookies are Secure on Vercel; allowed form origins include the Vercel production/preview hosts plus `APP_URL`. |
| Accessibility | axe-core (WCAG 2.1 A/AA) scans every page in dark and light themes as part of `pnpm e2e`. |

## What the prototype settles (reference/prototype.html, read 2026-10-03)

These are ported as-is into `src/engine`:

- **SoS**: `R` = number of Swiss rounds created so far (a bye round counts in `R`); a bye adds no
  opponent. `SoS = sum(opponent points / R) / R`. Extended SoS = mean of opponents' SoS (0 if none).
  Sort: points, SoS, extended SoS, then name.
- **Byes**: walk the standings from the bottom (dropped players excluded) and give the bye to the first
  player with no bye yet; if everyone has had one, the lowest-ranked player gets it. Round 1 order is
  shuffled first, so the round 1 bye is random. Bye = win of every game (3 single / 6 double).
- **Pairing**: depth-first backtracking over the standings order, 20,000-node budget per pass, passes in
  order: strict (no rematch, no side clash) -> allow side clash -> allow rematch -> sequential pairs.
  Side clash (single-sided only) = both players owe the same side (bias both > 0 or both < 0).
- **Single-sided sides**: bias = Corp games - Runner games; lower bias takes Corp; equal = coin flip.
- **Cut too big**: at Start Swiss the cut halves until it fits the field; below 4 it becomes no cut
  (top 8 with 7 players -> top 4; with 3 players -> none).
- **Default Swiss rounds**: single <16 -> 5 else 6; double <12 -> 3 else 4; capped at players - 1, min 1.
  Admin override is clamped to 1-9.
- **Cut seeding**: bracket order 1v8, 4v5, 2v7, 3v6 (recursive). Later rounds pair winners in bracket order.
- **Cut sides**: bias counted over cut games only. If A has played more Corp and B has not (B <= 0), B is
  Corp; mirror for B; otherwise coin flip.
- **Cut ties**: prototype has no draw button in the cut; Rules say the higher seed advances. The engine
  accepts a tie result in the cut and advances the higher seed.
- **Event points**: every entrant gets 1 (even one who dropped or joined late and never played). With a cut:
  champion 10, finalist 7, semi-final losers 5, quarter-final losers 3. Swiss-only: by final Swiss rank
  1st 10, 2nd 7, 3rd-4th 5, 5th-8th 3; rank 1 counts as a title.
- **Leaderboards**: only finished events count. Sort by total, titles (champion results), name; equal
  total and titles share a rank.
- **Restart cut round**: first cut round = re-seed from Swiss standings with fresh random sides; later
  round = re-pair previous round's winners with fresh sides.
- **Undo**: undo the last Swiss round (back to sign-up if none left); undo the last cut round (back to
  Swiss if it was the first). Reopen = back to Cut if a cut exists, else Swiss.
- **Defaults for new events**: single-sided, top 4 cut, rounds = engine default.

## Where the engine deliberately differs from the prototype

Both follow SPEC wording; the prototype behaviour looked accidental. Covered by unit tests.

1. **Restarting the first cut round** re-seeds with *random* sides. The prototype computed sides
   from the discarded round's games (SPEC: "Cut sides: random in round 1").
2. **Dropped players do not make the cut**; the next player in the standings moves up, and the cut
   shrinks by the same halving rule if too few players remain. The prototype seeded dropped players
   (SPEC: drops are "excluded from future pairings").
3. **Tied cut games** are accepted and advance the higher seed (prototype had no tie button).

Everything else is verified identical by `tests/engine/differential.test.ts`, which runs the
prototype's own JavaScript and the engine side by side on 640 random events with the same random
numbers, comparing pairings, sides, standings, SoS, event points and leaderboards after every step.

## Owner-accepted interpretations

- Sign-ups: every sign-up is approved by the admin into an entrant ("import sign-ups" in the prototype).
- Guest claim: admin links a guest's entrant records to an account in `/admin/players`.
- League season format (2026-10-04): events 1-3 Swiss only (3 rounds); the finale plays 3 Swiss
  rounds and a top 4 cut seeded from its own Swiss standings, worth double points. The finale's
  Swiss round count (3) was chosen to match the other events; the organizer can change it.
- Series cut matches (2026-10-04, house rule): the higher seed picks sides for game 1, sides swap
  for game 2, a coin flip sets sides for a deciding game 3 when level. A tied game counts for
  neither player; a tied game 3 advances the higher seed (same as single-game cuts). Sides can be
  changed until a result is in. Single-game cuts (prototype behaviour) stay available per event.
- One-off events (2026-10-04): no league points; own trophy and badges ("others on theme" chosen as
  Headliner and Crossover). One-off records store 0 points and season name "One-off".
- Round clock (2026-10-04): organizer-started; limits 45/65 Swiss, 65 + 45 (decider) per series cut
  match. A single-game cut match uses 45 (owner did not specify; single-sided time).
