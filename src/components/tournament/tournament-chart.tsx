"use client";

import { useState } from "react";
import { cx } from "@/components/ui";
import type { MatchView, RoundView } from "@/lib/tournament/queries";

type Game = "A" | "B" | "D" | null;

export interface ChartStanding {
  id: string;
  name: string;
  rank: number;
  points: number;
  inCut: boolean;
}

/** One player's line inside a match box. */
function Line({
  id,
  name,
  side,
  outcome,
  points,
  focus,
  onFocus,
}: {
  id: string;
  name: string;
  side: "Corp" | "Runner" | null;
  outcome: "W" | "L" | "T" | null;
  points?: number;
  focus: string | null;
  onFocus: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onFocus(id)}
      aria-pressed={focus === id}
      className={cx(
        "flex w-full items-center gap-1 px-2 py-1 text-left text-sm",
        outcome === "W" && "font-bold text-ok",
        outcome === "L" && "text-muted",
        focus === id && "bg-cyan/15",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {side && (
        <span
          className={cx("font-mono text-[9px] uppercase", side === "Corp" ? "text-magenta" : "text-cyan")}
        >
          {side === "Corp" ? "C" : "R"}
        </span>
      )}
      {outcome && <span className="w-4 text-center font-mono text-xs">{outcome}</span>}
      {points !== undefined && <span className="w-6 text-right font-mono text-xs text-muted">{points}</span>}
    </button>
  );
}

function outcomes(games: Game[]): ["W" | "L" | "T" | null, "W" | "L" | "T" | null] {
  const played = games.filter((g): g is "A" | "B" | "D" => g !== null);
  if (!played.length) return [null, null];
  const score = played.reduce((t, g) => t + (g === "A" ? 1 : g === "B" ? -1 : 0), 0);
  return score > 0 ? ["W", "L"] : score < 0 ? ["L", "W"] : ["T", "T"];
}

function MatchBox({
  m,
  double,
  points,
  focus,
  onFocus,
  label,
}: {
  m: MatchView;
  double: boolean;
  points?: Record<string, number>;
  focus: string | null;
  onFocus: (id: string) => void;
  label: string;
}) {
  const involved = focus !== null && (m.a.id === focus || m.b?.id === focus);
  if (!m.b) {
    return (
      <div
        className={cx("rounded border border-border bg-surface", involved && "border-cyan ring-2 ring-cyan")}
      >
        <p className="px-2 pt-1 font-mono text-[10px] text-muted uppercase">{label} · bye</p>
        <Line
          id={m.a.id}
          name={m.a.name}
          side={null}
          outcome="W"
          points={points?.[m.a.id]}
          focus={focus}
          onFocus={onFocus}
        />
      </div>
    );
  }
  const series = m.series;
  const games = series ? [m.g1, m.g2, series.g3] : double ? [m.g1, m.g2] : [m.g1];
  const [oa, ob] = series
    ? series.winnerId === null
      ? [null, null]
      : series.winnerId === m.a.id
        ? (["W", "L"] as const)
        : (["L", "W"] as const)
    : outcomes(games);
  // Series: game wins each (shown next to the result), sides only for game 1 (they swap after).
  const wins = (side: "A" | "B") => games.filter((g) => g === side).length;
  const corpA = m.corpId === null ? null : m.corpId === m.a.id;
  const awaiting = !!m.reports?.reports.length && !oa;
  return (
    <div
      className={cx("rounded border border-border bg-surface", involved && "border-cyan ring-2 ring-cyan")}
    >
      <p className="flex justify-between px-2 pt-1 font-mono text-[10px] text-muted uppercase">
        <span>{label}</span>
        {awaiting ? (
          <span className="text-warn">awaiting approval</span>
        ) : series && m.corpId === null ? (
          <span>picking sides</span>
        ) : !oa ? (
          <span>playing</span>
        ) : series ? (
          <span>
            {wins("A")}-{wins("B")}
            {series.g3 ? " (g3)" : ""}
          </span>
        ) : null}
      </p>
      <Line
        id={m.a.id}
        name={m.a.name}
        side={double || corpA === null ? null : corpA ? "Corp" : "Runner"}
        outcome={oa}
        points={points?.[m.a.id]}
        focus={focus}
        onFocus={onFocus}
      />
      <Line
        id={m.b.id}
        name={m.b.name}
        side={double || corpA === null ? null : corpA ? "Runner" : "Corp"}
        outcome={ob}
        points={points?.[m.b.id]}
        focus={focus}
        onFocus={onFocus}
      />
    </div>
  );
}

/**
 * Flowchart of an event: one column per Swiss round (who plays whom, sides, results and running
 * points), a standings column, then the top cut as a bracket. Tap a player to highlight their path.
 */
export function TournamentChart({
  swiss,
  cut,
  double,
  pointsAfter,
  standings,
  cutSize,
}: {
  swiss: RoundView[];
  cut: RoundView[];
  double: boolean;
  /** Points of every player after each Swiss round (same order as `swiss`). */
  pointsAfter: Record<string, number>[];
  standings: ChartStanding[];
  cutSize: number;
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const toggle = (id: string) => setFocus((f) => (f === id ? null : id));
  const focusName =
    focus &&
    (standings.find((s) => s.id === focus)?.name ??
      swiss.flatMap((r) => r.matches).find((m) => m.a.id === focus)?.a.name);

  return (
    <div>
      <p className="mb-2 text-xs text-muted" aria-live="polite">
        {focusName ? (
          <>
            Highlighting <span className="font-semibold text-cyan">{focusName}</span>.{" "}
            <button type="button" className="text-cyan underline" onClick={() => setFocus(null)}>
              Clear
            </button>
          </>
        ) : (
          "Tap a player to follow their path. Reported results show as awaiting approval until the organizer confirms them. C = Corp, R = Runner, W/L/T = result, last column = points after the round."
        )}
      </p>
      <div
        className="-mx-4 overflow-x-auto px-4 pb-2"
        tabIndex={0}
        role="region"
        aria-label="Tournament flowchart (scrolls sideways)"
      >
        <div className="flex items-stretch gap-6">
          {swiss.map((r, ri) => (
            <section key={`s${r.index}`} className="w-52 shrink-0" aria-label={r.label}>
              <h3 className="mb-2 font-mono text-xs tracking-widest text-magenta uppercase">
                {r.label}
                {!r.complete && <span className="text-muted"> · live</span>}
              </h3>
              <ol className="space-y-2">
                {r.matches.map((m) => (
                  <li key={m.index}>
                    <MatchBox
                      m={m}
                      double={double}
                      points={pointsAfter[ri]}
                      focus={focus}
                      onFocus={toggle}
                      label={m.b ? `Table ${m.index + 1}` : "Bye"}
                    />
                  </li>
                ))}
              </ol>
            </section>
          ))}

          {standings.length > 0 && (
            <section className="w-48 shrink-0" aria-label="Standings">
              <h3 className="mb-2 font-mono text-xs tracking-widest text-magenta uppercase">Standings</h3>
              <ol className="rounded border border-border bg-surface">
                {standings.map((s) => (
                  <li
                    key={s.id}
                    className={cx("border-b border-border last:border-b-0", s.inCut && "bg-cyan/10")}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      aria-pressed={focus === s.id}
                      className={cx(
                        "flex w-full items-center gap-2 px-2 py-1 text-left text-sm",
                        focus === s.id && "bg-cyan/15",
                      )}
                    >
                      <span className={cx("w-5 font-mono text-xs", s.inCut ? "text-cyan" : "text-muted")}>
                        {s.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="font-mono text-xs text-cyan">{s.points}</span>
                    </button>
                  </li>
                ))}
              </ol>
              {cutSize > 0 && (
                <p className="mt-1 text-[11px] text-muted">Highlighted: inside the top {cutSize} cut line.</p>
              )}
            </section>
          )}

          {cut.map((r, ci) => (
            <section key={`c${r.index}`} className="flex w-52 shrink-0 flex-col" aria-label={r.label}>
              <h3 className="mb-2 font-mono text-xs tracking-widest text-warn uppercase">{r.label}</h3>
              <ol className="flex flex-1 flex-col justify-around gap-2">
                {r.matches.map((m) => (
                  <li key={m.index} className="relative">
                    <MatchBox
                      m={m}
                      double={false}
                      focus={focus}
                      onFocus={toggle}
                      label={`Match ${m.index + 1}`}
                    />
                    {ci < cut.length - 1 && (
                      // Connector towards the next cut round.
                      <span aria-hidden className="absolute top-1/2 -right-6 h-px w-6 bg-border" />
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
