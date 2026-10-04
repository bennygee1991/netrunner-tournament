import {
  BADGES,
  CUT_SIZES,
  DEFAULT_ROUNDS,
  EVENT_POINTS,
  FINALE,
  LEAGUE_EVENT,
  ROUND_MINUTES,
  GAME_POINTS,
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
          heading: "Top cut (league format)",
          items: [
            "Each cut match is up to three games. The higher seed picks Corp or Runner for game 1, and sides swap for game 2.",
            "Win both games and you win the match. A tied game counts for neither player, so one win and one tie also wins.",
            "If the match is level after two games, game 3 decides it, with sides set by a coin flip (done by the site).",
            "If game 3 ends tied, the higher seed advances.",
          ],
        },
        {
          heading: "Top cut (single games, if the organizer chooses it)",
          items: [
            "Each cut match is one game. First cut round: sides are random.",
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
            "The cut is single elimination: lose a match and you are out. This is a house rule for our league; official NSG top 8 cuts are double elimination.",
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
            `Events 1-3 of a season are Swiss only: ${LEAGUE_EVENT.swissRounds} rounds, points per win, no cut.`,
            `The last event (the finale) plays ${FINALE.swissRounds} Swiss rounds, then a top ${FINALE.cutSize} cut seeded from its own Swiss standings (1 v 4, 2 v 3), in the league cut format above.`,
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
            `Round clock: ${ROUND_MINUTES.single} minutes for a single-sided Swiss round, ${ROUND_MINUTES.double} minutes for a double-sided round.`,
            `Top cut: each match gets ${ROUND_MINUTES.cutMatch} minutes for games 1 and 2, and a deciding game 3 gets its own ${ROUND_MINUTES.cutDecider} minutes. A single-game cut match gets ${ROUND_MINUTES.cutSingle} minutes.`,
            "The organizer starts the clock once everyone is seated, and can pause it or add time. The countdown shows on the event page and in the flowchart.",
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
      title: "Trophies and badges",
      tone: "magenta",
      blocks: [
        {
          heading: "Trophies",
          items: [
            "Season champion, runner-up and 3rd place: awarded from the Season board when the season ends.",
            "Month 1 and Month 2 champion: top of each month board when the season ends.",
            "Event champion: awarded when an event finishes. Finale champion: winning the season finale.",
            ...BADGES.filter((b) => b.group === "trophy").map((b) => `${b.label}: ${b.description}`),
          ],
        },
        {
          heading: "Badges",
          items: [
            ...BADGES.filter((b) => b.group !== "trophy").map((b) => `${b.label}: ${b.description}`),
            "Badges and achievement trophies are worked out from finished events and are never taken away. Walk-in guests don't earn them; register to start collecting.",
            "Corp and Runner wins and the opponents you've played are only counted from events finished after badges were added.",
          ],
        },
      ],
    },
  ];
}
