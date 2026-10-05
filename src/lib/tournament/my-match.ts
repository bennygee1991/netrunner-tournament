import type { MyMatchProps } from "@/components/tournament/my-match";
import type { EventView } from "./queries";

type Outcome = "win" | "tie" | "loss";

/** The signed-in player's open match in the current round, shaped for the "Your match" card. */
export function myOpenMatch(view: EventView, userId: string | undefined): MyMatchProps | null {
  if (!userId) return null;
  const me = view.entrants.find((e) => e.userId === userId);
  if (!me || me.dropped) return null;
  const phase: "swiss" | "cut" | null =
    view.meta.status === "SWISS" ? "swiss" : view.meta.status === "CUT" ? "cut" : null;
  if (!phase) return null;
  const round = (phase === "swiss" ? view.swiss : view.cut).at(-1);
  const m = round?.matches.find((x) => x.b && (x.a.id === me.id || x.b.id === me.id));
  if (!round || !m || !m.b) return null;
  const iAmA = m.a.id === me.id;
  const double = phase === "swiss" && view.meta.matchFormat === "DOUBLE";
  const opponent = iAmA ? m.b : m.a;
  const base: Omit<MyMatchProps, "games" | "sides"> = {
    eventId: view.meta.id,
    phase,
    round: round.index,
    match: m.index,
    roundLabel: round.label,
    table: m.index + 1,
    opponent: opponent.name,
    series: !!m.series,
  };
  const s = m.series;
  if (s && m.corpId === null) {
    // Series cut: the higher seed picks sides before anything can be reported.
    const iPick = s.pickerId === me.id;
    return {
      ...base,
      games: [],
      sides: { iPick, pickerName: iPick ? "you" : opponent.name, meId: me.id, opponentId: opponent.id },
    };
  }
  const open: (1 | 2 | 3)[] = [];
  if (m.g1 === null) open.push(1);
  if ((double || s) && m.g2 === null) open.push(2);
  if (s?.decider && s.g3 === null) open.push(3);
  if (!open.length) return null;

  const toOutcome = (r: "A" | "B" | "D"): Outcome =>
    r === "D" ? "tie" : (r === "A") === iAmA ? "win" : "loss";
  const games = open.map((game) => {
    const reports = m.reports?.reports.filter((r) => r.game === game) ?? [];
    const mine = reports.find((r) => r.reporterId === userId);
    const theirs = reports.find((r) => r.reporterId !== userId);
    const corpIsMe =
      game === 3
        ? s?.corp3Id
          ? s.corp3Id === me.id
          : null
        : m.corpId === null
          ? null
          : (m.corpId === me.id) !== (game === 2);
    return {
      game,
      mySide: corpIsMe === null ? null : corpIsMe ? ("Corp" as const) : ("Runner" as const),
      myReport: mine ? toOutcome(mine.result) : null,
      opponentReported: !!theirs,
      agrees: mine && theirs ? mine.result === theirs.result : null,
    };
  });
  return { ...base, games };
}
