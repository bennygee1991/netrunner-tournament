import { byePoints } from "@/engine";
import { cx } from "@/components/ui";
import type { MatchView } from "@/lib/tournament/queries";

type Game = "A" | "B" | "D" | null;

function Player({
  name,
  role,
  state,
}: {
  name: string;
  role: "Corp" | "Runner" | null;
  state: "won" | "lost" | "tie" | "open";
}) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-1 flex-col items-center justify-center rounded border px-2 py-2 text-center",
        state === "won" ? "border-ok text-ok" : "border-border",
        state === "lost" && "border-dashed text-muted",
      )}
    >
      <span className="w-full truncate font-semibold">{name}</span>
      {role && (
        <span
          className={cx(
            "font-mono text-[10px] tracking-widest uppercase",
            role === "Corp" ? "text-magenta" : "text-cyan",
          )}
        >
          {role}
        </span>
      )}
    </div>
  );
}

function stateFor(result: Game, side: "A" | "B") {
  if (!result) return "open" as const;
  if (result === "D") return "tie" as const;
  return result === side ? ("won" as const) : ("lost" as const);
}

/** One game line: A vs B with sides and the result. */
export function GameLine({
  a,
  b,
  corpIsA,
  result,
}: {
  a: string;
  b: string;
  corpIsA: boolean | null;
  result: Game;
}) {
  const roleA = corpIsA === null ? null : corpIsA ? "Corp" : "Runner";
  const roleB = corpIsA === null ? null : corpIsA ? "Runner" : "Corp";
  return (
    <div className="flex items-stretch gap-2">
      <Player name={a} role={roleA} state={stateFor(result, "A")} />
      <span
        className={cx(
          "flex w-12 shrink-0 items-center justify-center font-mono text-xs uppercase",
          result === "D" ? "text-warn" : "text-muted",
        )}
      >
        {result === "D" ? "tie" : "vs"}
      </span>
      <Player name={b} role={roleB} state={stateFor(result, "B")} />
    </div>
  );
}

/** Read-only match: one line (single-sided / cut) or two lines (double-sided, sides swap in game 2). */
export function MatchCard({ match, double, table }: { match: MatchView; double: boolean; table?: number }) {
  if (!match.b) {
    return (
      <div className="flex items-center gap-3 py-1">
        <span className="font-semibold text-ok">{match.a.name}</span>
        <span className="font-mono text-xs text-muted">BYE · +{byePoints(double ? "double" : "single")}</span>
      </div>
    );
  }
  const corpIsA = match.corpId === null ? null : match.corpId === match.a.id;
  const awaiting = !!match.reports?.reports.length;
  return (
    <div className="space-y-1 py-1">
      {awaiting && (
        <p className="font-mono text-[11px] text-warn">⏳ Result reported, awaiting organizer approval</p>
      )}
      {table !== undefined && (
        <p className="font-mono text-[11px] tracking-widest text-muted uppercase">Table {table}</p>
      )}
      {double ? (
        <>
          <p className="font-mono text-[11px] text-muted uppercase">Game 1</p>
          <GameLine a={match.a.name} b={match.b.name} corpIsA={corpIsA} result={match.g1} />
          <p className="font-mono text-[11px] text-muted uppercase">Game 2 · sides swap</p>
          <GameLine
            a={match.a.name}
            b={match.b.name}
            corpIsA={corpIsA === null ? null : !corpIsA}
            result={match.g2}
          />
        </>
      ) : (
        <GameLine a={match.a.name} b={match.b.name} corpIsA={corpIsA} result={match.g1} />
      )}
    </div>
  );
}
