import {
  CUT_SIZES,
  DEFAULT_ROUNDS,
  EVENT_POINTS,
  FINALE,
  GAME_POINTS,
  MILESTONES,
  SEASON,
  SWISS_ROUNDS_MAX,
  byePoints,
} from "@/engine";

/**
 * The in-app Rules page, generated from the engine's constants so the text cannot drift from what
 * the engine does. Rule sources: reference/prototype.html rules page, docs/SPEC.md section 4,
 * NSG Organized Play Policies v1.6.2.
 */
export interface RulesSection {
  id: string;
  title: string;
  tone: "cyan" | "magenta" | "warn";
  blocks: { heading?: string; items: string[] }[];
}

export const NSG_POLICIES_URL =
  "https://nullsignal.games/wp-content/uploads/2023/06/NSG_Organized_Play_Policies.pdf";

export function rulesContent(): RulesSection[] {
  const cutSizes = CUT_SIZES.filter((c) => c > 0).join(" or ");
  return [
    {
      id: "sides",
      title: "Who plays Corp or Runner?",
      tone: "magenta",
      blocks: [
        {
          heading: "Swiss, single-sided (default)",
          items: [
            "Each round is one game. The site assigns your side when it makes the pairings.",
            "Whoever has played more Corp games so far takes Runner, and vice versa. If you are even, it is a coin flip.",
            "Pairings also try to avoid putting two players who both owe the same side against each other.",
          ],
        },
        {
          heading: "Swiss, double-sided",
          items: [
            "Each round is a two-game match and you play both sides.",
            "A coin flip (done by the site) decides who is Corp in game 1. Sides swap for game 2.",
          ],
        },
        {
          heading: "Top cut",
          items: [
            "Cut games are always single games.",
            "First cut round: sides are random.",
            "After that: if one player has played more Corp in the cut and the other has not (more Runner, or an even split), each takes the side they have played less. Otherwise it is random.",
            "If a cut game ends tied, the higher seed advances.",
          ],
        },
      ],
    },
    {
      id: "scoring",
      title: "Scoring and tiebreaks",
      tone: "cyan",
      blocks: [
        {
          items: [
            `Each game: win ${GAME_POINTS.win} · tie ${GAME_POINTS.tie} · loss ${GAME_POINTS.loss}.`,
            `Bye: the points for winning every game in the round (${byePoints("single")} single-sided, ${byePoints("double")} double-sided). A bye is not an opponent.`,
            "The round 1 bye is random. Later byes go to the lowest-ranked player who has not had one yet.",
            "Tiebreaks, in order: strength of schedule (SoS: the average of your opponents' points per round), then extended SoS (the average of your opponents' SoS), then name.",
            "The name tiebreak is a fixed stand-in for the random draw used at official events, so standings never change on reload.",
          ],
        },
      ],
    },
    {
      id: "swiss",
      title: "Swiss rounds",
      tone: "cyan",
      blocks: [
        {
          items: [
            "Round 1 is paired at random. Later rounds pair players with the same score, and never pair the same two players twice if it can be avoided.",
            `Default number of rounds: single-sided ${DEFAULT_ROUNDS.single.below} (${DEFAULT_ROUNDS.single.atOrAbove} with ${DEFAULT_ROUNDS.single.threshold}+ players); double-sided ${DEFAULT_ROUNDS.double.below} (${DEFAULT_ROUNDS.double.atOrAbove} with ${DEFAULT_ROUNDS.double.threshold}+ players). Never more than players minus 1. The organizer can set 1-${SWISS_ROUNDS_MAX}.`,
            "Late players join the next round with zero points. Players who drop stay in the standings but are not paired again and cannot make the cut.",
          ],
        },
      ],
    },
    {
      id: "cut",
      title: "Top cut",
      tone: "warn",
      blocks: [
        {
          items: [
            `Events can end with a top ${cutSizes} cut, seeded from the final Swiss standings: 1 v 8, 4 v 5, 2 v 7, 3 v 6 (top 4: 1 v 4, 2 v 3).`,
            "If there are fewer players than the cut size, the cut halves until it fits; with fewer than 4 players there is no cut.",
            "Our top 8 is single elimination, a house rule for casual events. Official NSG top 8 cuts are double elimination.",
          ],
        },
      ],
    },
    {
      id: "finale",
      title: "Season finale",
      tone: "warn",
      blocks: [
        {
          items: [
            `The last event of the season plays ${FINALE.swissRounds} Swiss round, then a top ${FINALE.cutSize} cut.`,
            `The cut is decided by the Season leaderboard, not the Swiss round: the top ${FINALE.cutSize} entrants by season points (then event wins) qualify and are seeded in that order. Ties on both are broken by the finale's Swiss standings.`,
            "Entrants with no season points can still qualify if there are free places, in Swiss order.",
            `League points from the finale are doubled (×${FINALE.pointsMultiplier}).`,
          ],
        },
      ],
    },
    {
      id: "time",
      title: "Rounds and time",
      tone: "cyan",
      blocks: [
        {
          items: [
            "Single-sided rounds: about 40-45 minutes. Double-sided: 65-70.",
            "When time is called, the active player finishes their turn, then the other player takes a final turn. Most agenda points wins; equal means a tie.",
            "Intentional draws are allowed if both players tell the organizer within 5 minutes of the round starting. It scores as a tie.",
          ],
        },
      ],
    },
    {
      id: "league",
      title: "League points and prizes",
      tone: "warn",
      blocks: [
        {
          items: [
            `Event placing: champion ${EVENT_POINTS.champion} · finalist ${EVENT_POINTS.finalist} · top 4 ${EVENT_POINTS.top4} · top 8 ${EVENT_POINTS.top8} · everyone else who entered ${EVENT_POINTS.played}.`,
            "Events without a cut use the final Swiss rank with the same table.",
            `A season is ${SEASON.events} events, one every ${SEASON.daysBetweenEvents / 7} weeks. Events 1-${SEASON.eventsPerMonth} feed the Month 1 board, the rest feed Month 2, and all of them feed the Season board.`,
            "Boards are sorted by points, then event wins, then name. Players level on both share a place.",
            `The season finale (the last event) is worth ×${FINALE.pointsMultiplier} league points: champion ${EVENT_POINTS.champion * FINALE.pointsMultiplier} · finalist ${EVENT_POINTS.finalist * FINALE.pointsMultiplier} · top 4 ${EVENT_POINTS.top4 * FINALE.pointsMultiplier} · top 8 ${EVENT_POINTS.top8 * FINALE.pointsMultiplier} · entered ${EVENT_POINTS.played * FINALE.pointsMultiplier}. This counts on the Month 2 and Season boards.`,
            "At the end of the season: prizes for the top of each board, then the boards move to Past seasons and everything resets.",
          ],
        },
      ],
    },
    {
      id: "trophies",
      title: "Trophies",
      tone: "magenta",
      blocks: [
        {
          items: [
            "Season champion, runner-up and 3rd place: awarded from the Season board when the season ends.",
            "Event champion: awarded when an event finishes.",
            ...Object.values(MILESTONES).map((m) => `${m.label}: ${m.description}`),
          ],
        },
      ],
    },
  ];
}
