# Netrunner Circuit: product spec

## 1. Roles
- **Visitor**: sees Rules, public Events and Leaderboards (read-only).
- **Player**: registered account. Signs up for events, edits own profile, sees own history.
- **Admin**: the organizer. Everything below, plus all admin tools. Bootstrap the first admin by a
  one-time seed script that reads `ADMIN_RUNNER_NAME` and `ADMIN_PASSWORD` from env.

## 2. Pages
Public: `/` (next event + sign-up call to action), `/register`, `/login`, `/events`, `/events/[id]`,
`/leaderboards` (tabs: Month 1, Month 2, Season, Past seasons), `/rules`, `/players/[runnerName]`.
Player: `/account` (change password, display preferences, my sign-ups, my results).
Admin: `/admin` (dashboard), `/admin/season`, `/admin/events/[id]` (run the event), `/admin/players`,
`/admin/audit`.

## 3. Accounts
- Register: runner name (unique, case-insensitive) + password (min 10 chars, check against a small
  common-password list) + confirm. Optional email for recovery.
- Login with runner name + password. Logout. Session expiry 30 days sliding.
- No email required, so password reset is done by the admin: `/admin/players` can issue a one-time
  temporary password that forces a change at next login. If an email is on file, also offer email reset
  (behind an env flag, off by default).
- Admin can rename a runner name (to fix typos), disable an account, or delete it (anonymize results).

## 4. Tournament engine (pure TS, fully tested)
Port from `reference/prototype.html`. Behaviours to preserve:

**Season**: 2 months, 4 events, one every 2 weeks. Events 1-2 are Month 1, events 3-4 are Month 2.
**Match format per event**: `single` (1 game per round, default) or `double` (2 games per round).
**Scoring per game**: win 3, tie 1, loss 0. Bye = points of winning every game in the round
(3 single, 6 double). Round 1 bye is random. Later byes go to the lowest-ranked player without a bye.
**Pairing**: round 1 random. Later rounds pair by score, never a rematch if avoidable, using
backtracking with a node budget and these fallbacks in order: strict, allow side clash, allow rematch,
sequential. Dropped players are excluded.
**Sides, single-sided Swiss**: the player with fewer Corp-minus-Runner games takes Corp. Equal = random.
Pairing prefers opponents without the same side bias.
**Sides, double-sided Swiss**: random flip for who is Corp in game 1. Sides swap in game 2.
**Tiebreaks**: Strength of Schedule = sum over opponents of (their points / rounds so far), divided by
rounds so far. Then Extended SoS = mean of opponents' SoS. Then name (documented deterministic stand-in
for NSG's random draw).
**Top cut**: 0, 4 or 8 players, standard seeding (1v8, 4v5, 2v7, 3v6), always single games.
Cut sides: random in round 1. After that, if one player has played more Corp in the cut and the other more
Runner (or an even split), each plays the side they have played less. Otherwise random.
Ties in a cut game: the higher seed advances. Top 8 single-elim is a house rule, so flag it in the UI;
add double elimination as a later milestone (NSG 1.1.11.2 to 1.1.11.4).
**Default Swiss rounds**: single: <16 players 5, else 6. Double: <12 players 3, else 4. Always capped at
players minus 1. Admin can override.
**Event points for leaderboards**: champion 10, finalist 7, top 4 = 5, top 8 = 3, everyone else who played = 1.
Swiss-only events use final Swiss rank with the same table.
**Leaderboards**: Month 1, Month 2, Season (both months). Sort by total, then titles, then name.
Equal total and titles share a rank.
**Season end**: admin picks prize winners (top of each board), archives a snapshot (names, points, prizes)
to Past seasons, then resets events and boards. Accounts are kept.

## 5. Admin tools (all server-enforced and audit-logged)
- Create season (name, first event date) which generates the 4 events.
- Event setup: name, date, month, match format, Swiss rounds, cut size.
- Registrations: approve sign-ups into entrants, add a walk-in player (creates a lightweight "guest" player
  that can be claimed by an account later), remove entrants before start.
- Run event: start Swiss, pair next round, enter results (single or per-game), start cut, auto-advance cut.
- **Restart round**: discard the current round's pairings and results and pair again.
  Includes late additions and excludes drops. Same for cut rounds.
- **Add late player** mid-event: joins the next pairing (or the restarted round) with zero points.
- **Drop player**: excluded from future pairings, kept in standings. Can be undone.
- **Repair mode**: edit any earlier round's results. Standings recompute, existing pairings are untouched.
- Undo last round, reopen a finished event, reset a single event.
- **Reset season** (typed confirmation): archive then clear.
- **Reset everything / all seasons** (typed confirmation "RESET"): wipes seasons, events, results, past seasons
  and sign-ups. Keeps accounts unless a second checkbox "also delete player accounts" is ticked.
- Prize fields per leaderboard, shown publicly.
- Audit log: who, what, when, before/after summary.

## 6. Data model (Prisma sketch)
User(id, runnerName, runnerNameLower unique, passwordHash, email?, role[PLAYER|ADMIN], mustChangePassword,
disabledAt?, createdAt)
Session(id, userId, expiresAt) or handled by the auth library
Season(id, name, startDate, status[ACTIVE|ARCHIVED], prizesJson)
Event(id, seasonId, index, name, date, month[1|2], status[SIGNUP|SWISS|CUT|DONE], matchFormat, swissRounds, cutSize)
Entrant(id, eventId, userId?, guestName?, dropped bool)
Signup(id, eventId, userId, createdAt)
Round(id, eventId, phase[SWISS|CUT], number)
Match(id, roundId, aEntrantId, bEntrantId?, corpEntrantId?, result1?, result2?)  // results: A|B|D
LeaderboardSnapshot(id, seasonId, boardKey, rowsJson)  // written at season end
AuditLog(id, actorId, action, detailJson, createdAt)

## 7. Security checklist
argon2id, per-IP and per-account login throttling, CSRF protection on mutations, secure cookies,
strict input validation, no user enumeration on login or register errors where practical (runner names are
public, so say "taken"), security headers, admin routes behind role check in middleware and in each handler.

## 8. Milestones
1. Repo scaffold, CI, docker-compose Postgres, Prisma schema, seed admin.
2. Auth: register, login, logout, account page, admin password reset. E2E tests.
3. Engine package with unit tests (pairing, sides, scoring, tiebreaks, cut, leaderboards).
4. Season and event admin, sign-up flow, run an event end to end.
5. Admin repair tools (restart, late add, drop, repair, undo, reset season, reset all) with audit log.
6. Leaderboards, past seasons, player profile pages, Rules page.
7. Polish, accessibility pass, deploy, backups, README for the organizer.

## 9. Additions (owner request, 2026-10-03)
- **Home page sign-up**: logged-in players sign up for open events straight from `/` (backend-backed,
  replaces the prototype's per-browser sign-up doc). Visitors see a call to action to register / log in.
- **Profiles**: `/players/[runnerName]` with event history, leaderboard finishes and trophies; players
  can edit a short bio and display preferences from `/account`.
- **Trophies**, shown on profiles and in Past seasons, kept across season resets, wiped only by
  "Reset everything":
  - Season champion, 2nd and 3rd place: awarded when a season is archived.
  - Event champion: awarded when an event finishes.
  - Milestones (initial set, owner may change): first event played, 10 events played,
    undefeated Swiss (finished an event's Swiss with no game lost).
- **No email**: no notifications and no email password reset. Password resets are admin-only.

## 10. Season finale (owner decision, 2026-10-04)
- The last event of a season is the **Season finale** (created automatically; any event can be
  marked as the finale in setup before it starts).
- Format: 1 Swiss round for everyone, then a top 8 cut (single elimination until double
  elimination is built).
- The cut is decided by the **Season board** (finished events so far): top 8 by season points,
  then event wins; ties broken by the finale's Swiss standings. Seeds fixed when the cut starts.
- League points from the finale are doubled on the Month 2 and Season boards.
