import { cutSeeds } from "./cut";
import { SEASON } from "./rules";
import { swissGames } from "./standings";
import type { EventState, GameResult, Match, NameOf } from "./types";

/**
 * Badges and achievement trophies (league house feature, owner decision 2026-10-04). They are
 * worked out from each player's permanent event records, so nobody awards them by hand and they
 * survive season resets. None of this changes pairings, standings or league points.
 */

export type BadgeGroup = "trophy" | "attendance" | "results" | "sides" | "community";

export interface BadgeDef {
  key: string;
  icon: string;
  label: string;
  description: string;
  group: BadgeGroup;
}

const def = (group: BadgeGroup, key: string, icon: string, label: string, description: string): BadgeDef => ({
  key,
  icon,
  label,
  description,
  group,
});

export const BADGE_THRESHOLDS = {
  events: [1, 5, 10, 25, 50],
  cuts: [1, 3, 10],
  sideWins: [10, 25, 50],
  opponents: 20,
  ties: 3,
  reports: 10,
  balancedWins: 10,
  dynastyTitles: 2,
  ironmanSeasons: 2,
} as const;

export const BADGES: readonly BadgeDef[] = [
  // Achievement trophies (shown in the trophy cabinet).
  def("trophy", "back-to-back", "🔁", "Back-to-back", "Won two league events in a row."),
  def(
    "trophy",
    "perfect-event",
    "💎",
    "Perfect event",
    "Won an event without losing or tying a game, cut included.",
  ),
  def("trophy", "dynasty", "🏛️", "Dynasty", "Won the season twice."),
  def("trophy", "underdog", "🧗", "Underdog", "Won an event from the lowest seed in the cut."),
  // Turning up.
  def("attendance", "first-event", "🔌", "Jacked in", "Played a first league event."),
  def("attendance", "five-events", "🔋", "Regular", "Played 5 league events."),
  def("attendance", "ten-events", "🎖️", "Veteran", "Played 10 league events."),
  def("attendance", "twentyfive-events", "🛰️", "Old guard", "Played 25 league events."),
  def("attendance", "fifty-events", "🧬", "Legend", "Played 50 league events."),
  def("attendance", "full-season", "📅", "Full season", `Played all ${SEASON.events} events of a season.`),
  def("attendance", "ironman", "🔥", "Ironman", "Played every event of two seasons in a row."),
  def("attendance", "early-adopter", "🤖", "Early adopter", "Played in the league's first season."),
  // Playing well.
  def("results", "made-cut", "✂️", "Made the cut", "Reached a top cut."),
  def("results", "cut-regular", "🪒", "Cut regular", "Reached 3 top cuts."),
  def("results", "cut-machine", "⚙️", "Cut machine", "Reached 10 top cuts."),
  def("results", "finalist", "🎯", "Finalist", "Played in a final."),
  def(
    "results",
    "undefeated-swiss",
    "🛡️",
    "Flawless Swiss",
    "Finished an event's Swiss rounds without losing a game.",
  ),
  def("results", "comeback", "📈", "Comeback", "Lost round 1 and still made the cut."),
  def("results", "diplomat", "🤝", "Diplomat", "Tied 3 games in one event."),
  // Sides.
  def("sides", "corp-10", "🏢", "Middle manager", "Won 10 games as the Corp."),
  def("sides", "corp-25", "🏙️", "Executive", "Won 25 games as the Corp."),
  def("sides", "corp-50", "🏦", "CEO", "Won 50 games as the Corp."),
  def("sides", "runner-10", "🏃", "Netrunner", "Won 10 games as the Runner."),
  def("sides", "runner-25", "💻", "Console cowboy", "Won 25 games as the Runner."),
  def("sides", "runner-50", "👾", "Ghost in the net", "Won 50 games as the Runner."),
  def("sides", "balanced", "⚖️", "Balanced", "Won 10 games with each side."),
  // Community.
  def("community", "mentor", "🧑‍🏫", "Mentor", "Played against 20 different registered players."),
  def(
    "community",
    "reporter",
    "🧾",
    "Reporter",
    "Reported 10 of your own results that the organizer approved.",
  ),
];

const EVENT_LADDER = [
  "first-event",
  "five-events",
  "ten-events",
  "twentyfive-events",
  "fifty-events",
] as const;
const CUT_LADDER = ["made-cut", "cut-regular", "cut-machine"] as const;

export const BADGE_BY_KEY: ReadonlyMap<string, BadgeDef> = new Map(BADGES.map((b) => [b.key, b]));

/** What a finished event tells us about one player (stored on their permanent event record). */
export interface PlayerEventFacts {
  madeCut: boolean;
  /** Seed in the cut, and the cut's size (null without a cut). */
  cutSeed: number | null;
  cutSize: number | null;
  /** Tied cut games (a tied cut game advances the higher seed). */
  cutDraws: number;
  /** Cut games lost (series cut matches can be won after losing a game). */
  cutLosses: number;
  /** Lost their round 1 match (byes never count as a loss). */
  lostFirstRound: boolean;
  /** Games won as Corp / as Runner, Swiss and cut, byes excluded. */
  corpWins: number;
  runnerWins: number;
  /** Everyone they played (entrant ids), Swiss and cut, byes excluded. */
  opponents: string[];
}

/**
 * Corp side of each game of a match: game 1 uses `corp`, game 2 swaps (double-sided Swiss and
 * series cut), a series decider uses `corp3`.
 */
function gamesWithCorp(
  games: (GameResult | null)[],
  m: Match,
): { g: GameResult | null; corp: string | null }[] {
  const id = (side: "a" | "b" | null | undefined) => (side == null ? null : side === "a" ? m.a : m.b);
  const first = id(m.corp);
  const other = first === null ? null : first === m.a ? m.b : m.a;
  return games.map((g, i) => ({ g, corp: i === 0 ? first : i === 1 ? other : id(m.corp3) }));
}

function winnerOf(g: GameResult | null, m: Match): string | null {
  return g === "A" ? m.a : g === "B" ? m.b : null;
}

/** Facts for every entrant of a finished event. */
export function playerEventFacts(ev: EventState, nameOf: NameOf): Map<string, PlayerEventFacts> {
  const out = new Map<string, PlayerEventFacts>();
  for (const id of ev.entrants) {
    out.set(id, {
      madeCut: false,
      cutSeed: null,
      cutSize: null,
      cutDraws: 0,
      cutLosses: 0,
      lostFirstRound: false,
      corpWins: 0,
      runnerWins: 0,
      opponents: [],
    });
  }
  const tally = (m: Match, games: (GameResult | null)[], cut: boolean) => {
    if (m.b === null) return;
    const fa = out.get(m.a);
    const fb = out.get(m.b);
    if (!fa || !fb) return;
    if (!fa.opponents.includes(m.b)) fa.opponents.push(m.b);
    if (!fb.opponents.includes(m.a)) fb.opponents.push(m.a);
    for (const { g, corp } of gamesWithCorp(games, m)) {
      const w = winnerOf(g, m);
      if (g === "D" && cut) {
        fa.cutDraws++;
        fb.cutDraws++;
      }
      if (cut && w) out.get(w === m.a ? m.b! : m.a)!.cutLosses++;
      if (!w || corp === null) continue;
      const f = out.get(w)!;
      if (w === corp) f.corpWins++;
      else f.runnerWins++;
    }
  };

  ev.rounds.forEach((r, ri) => {
    for (const m of r.matches) {
      const games = swissGames(ev.format, m);
      tally(m, games, false);
      if (ri === 0 && m.b !== null) {
        const score = games.reduce((t, g) => t + (g === "A" ? 1 : g === "B" ? -1 : 0), 0);
        if (score < 0) out.get(m.a)!.lostFirstRound = true;
        if (score > 0) out.get(m.b)!.lostFirstRound = true;
      }
    }
  });
  for (const r of ev.cut) {
    for (const m of r.matches)
      tally(m, ev.cutFormat === "series" ? [m.g1, m.g2, m.g3 ?? null] : [m.g1], true);
  }

  if (ev.cut.length) {
    const seeds = cutSeeds(ev, nameOf);
    const size = ev.cut[0]!.matches.length * 2;
    for (const m of ev.cut[0]!.matches) {
      for (const id of [m.a, m.b]) {
        const f = id ? out.get(id) : undefined;
        if (!f) continue;
        f.madeCut = true;
        f.cutSeed = seeds.get(id!) ?? null;
        f.cutSize = size;
      }
    }
  }
  return out;
}

/** One permanent event record, as the badge rules need it. */
export interface BadgeRecord {
  eventKey: string;
  seasonKey: string;
  rank: number;
  champion: boolean;
  undefeated: boolean;
  wins: number;
  draws: number;
  losses: number;
  madeCut: boolean;
  cutSeed: number | null;
  cutSize: number | null;
  cutDraws: number;
  cutLosses: number;
  lostFirstRound: boolean;
  corpWins: number;
  runnerWins: number;
  /** Registered opponents (account ids). */
  opponentIds: readonly string[];
}

export interface BadgeContext {
  /** Every league event in play order (event keys). */
  eventOrder: readonly string[];
  /** Every season in play order (season keys); the first one is the league's first season. */
  seasonOrder: readonly string[];
}

export interface PlayerBadgeInput {
  /** The player's records in play order (oldest first). */
  records: readonly BadgeRecord[];
  /** Season champion trophies held. */
  seasonTitles: number;
  /** Own result reports the organizer approved. */
  reportsApproved: number;
}

export interface EarnedBadge {
  key: string;
  /** Event at which it was earned (null for badges not tied to an event). */
  eventKey: string | null;
}

/** Badges a player holds, each with the event that earned it. Badges are never lost. */
export function computeBadges(input: PlayerBadgeInput, ctx: BadgeContext): EarnedBadge[] {
  const T = BADGE_THRESHOLDS;
  const earned = new Map<string, string | null>();
  const earn = (key: string, eventKey: string | null) => {
    if (!earned.has(key)) earned.set(key, eventKey);
  };
  const eventIndex = new Map(ctx.eventOrder.map((k, i) => [k, i]));
  const seasonIndex = new Map(ctx.seasonOrder.map((k, i) => [k, i]));
  const perSeason = new Map<string, number>();
  const fullSeasons = new Set<string>();
  const opponents = new Set<string>();
  let events = 0;
  let cuts = 0;
  let corp = 0;
  let runner = 0;
  let lastTitleIndex: number | null = null;

  for (const r of input.records) {
    const at = r.eventKey;
    events++;
    T.events.forEach((n, i) => {
      if (events >= n) earn(EVENT_LADDER[i]!, at);
    });

    const inSeason = (perSeason.get(r.seasonKey) ?? 0) + 1;
    perSeason.set(r.seasonKey, inSeason);
    if (inSeason >= SEASON.events && !fullSeasons.has(r.seasonKey)) {
      fullSeasons.add(r.seasonKey);
      earn("full-season", at);
      const si = seasonIndex.get(r.seasonKey);
      const prev = si !== undefined && si > 0 ? ctx.seasonOrder[si - 1] : undefined;
      if (prev !== undefined && fullSeasons.has(prev)) earn("ironman", at);
    }
    if (ctx.seasonOrder.length && r.seasonKey === ctx.seasonOrder[0]) earn("early-adopter", at);

    if (r.madeCut) {
      cuts++;
      T.cuts.forEach((n, i) => {
        if (cuts >= n) earn(CUT_LADDER[i]!, at);
      });
      if (r.rank <= 2) earn("finalist", at);
      if (r.lostFirstRound) earn("comeback", at);
    }
    if (r.undefeated) earn("undefeated-swiss", at);
    if (r.draws + r.cutDraws >= T.ties) earn("diplomat", at);

    if (r.champion) {
      const idx = eventIndex.get(r.eventKey);
      if (idx !== undefined && lastTitleIndex !== null && idx === lastTitleIndex + 1)
        earn("back-to-back", at);
      if (idx !== undefined) lastTitleIndex = idx;
      if (r.madeCut && r.losses === 0 && r.draws === 0 && r.cutDraws === 0 && r.cutLosses === 0)
        earn("perfect-event", at);
      if (r.madeCut && r.cutSeed !== null && r.cutSize !== null && r.cutSeed === r.cutSize)
        earn("underdog", at);
    }

    corp += r.corpWins;
    runner += r.runnerWins;
    for (const n of T.sideWins) {
      if (corp >= n) earn(`corp-${n}`, at);
      if (runner >= n) earn(`runner-${n}`, at);
    }
    if (corp >= T.balancedWins && runner >= T.balancedWins) earn("balanced", at);

    for (const o of r.opponentIds) opponents.add(o);
    if (opponents.size >= T.opponents) earn("mentor", at);
  }

  if (input.seasonTitles >= T.dynastyTitles) earn("dynasty", null);
  if (input.reportsApproved >= T.reports) earn("reporter", null);

  // Definition order, so every list shows badges the same way.
  return BADGES.filter((b) => earned.has(b.key)).map((b) => ({ key: b.key, eventKey: earned.get(b.key)! }));
}
