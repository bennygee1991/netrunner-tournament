"use client";

import { ActionForm } from "@/components/action-form";
import { cx } from "@/components/ui";
import type { FormState } from "@/lib/forms/state";
import type { MatchView } from "@/lib/tournament/queries";

type Game = "A" | "B" | "D" | null;

function Buttons({
  match,
  current,
  corpIsA,
  allowTie,
  tieLabel,
}: {
  match: MatchView;
  current: Game;
  corpIsA: boolean | null;
  allowTie: boolean;
  tieLabel: string;
}) {
  const btn = (value: "A" | "B" | "D", label: string, sub?: string) => {
    const on = current === value;
    return (
      <button
        type="submit"
        name="result"
        // Pressing the selected result again clears it.
        value={on ? "" : value}
        aria-pressed={on}
        className={cx(
          "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded border px-2 py-1 text-center",
          on
            ? value === "D"
              ? "border-warn text-warn"
              : "border-ok bg-ok/10 text-ok"
            : "border-border hover:border-cyan",
          current && !on && "opacity-60",
          value === "D" && "max-w-20 flex-none font-mono text-xs uppercase",
        )}
      >
        <span className="w-full truncate font-semibold">{label}</span>
        {sub && (
          <span
            className={cx(
              "font-mono text-[10px] tracking-widest uppercase",
              sub === "Corp" ? "text-magenta" : "text-cyan",
            )}
          >
            {sub}
          </span>
        )}
      </button>
    );
  };
  const roleA = corpIsA === null ? undefined : corpIsA ? "Corp" : "Runner";
  const roleB = corpIsA === null ? undefined : corpIsA ? "Runner" : "Corp";
  return (
    <div className="flex items-stretch gap-2">
      {btn("A", match.a.name, roleA)}
      {allowTie ? (
        btn("D", tieLabel)
      ) : (
        <span className="w-12 shrink-0 self-center text-center font-mono text-xs text-muted">vs</span>
      )}
      {btn("B", match.b!.name, roleB)}
    </div>
  );
}

/** Tap the winner (or tie). Tapping the chosen result again clears it. */
export function ResultEntry({
  action,
  eventId,
  phase,
  round,
  match,
  double,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  eventId: string;
  phase: "swiss" | "cut";
  round: number;
  match: MatchView;
  double: boolean;
}) {
  if (!match.b) return null;
  const corpIsA = match.corpId === null ? null : match.corpId === match.a.id;
  const base = { eventId, phase, round, match: match.index, a: match.a.id, b: match.b.id };
  const tieLabel = phase === "cut" ? "Tie*" : "Tie";
  return (
    <div className="space-y-1 py-2" data-testid={`match-${phase}-${round}-${match.index}`}>
      <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
        Table {match.index + 1}
        {double && " · Game 1"}
      </p>
      <ActionForm action={action} fields={{ ...base, game: 1 }} showMessage={false}>
        <Buttons match={match} current={match.g1} corpIsA={corpIsA} allowTie tieLabel={tieLabel} />
      </ActionForm>
      {double && (
        <>
          <p className="font-mono text-[11px] tracking-widest text-muted uppercase">Game 2 · sides swap</p>
          <ActionForm action={action} fields={{ ...base, game: 2 }} showMessage={false}>
            <Buttons
              match={match}
              current={match.g2}
              corpIsA={corpIsA === null ? null : !corpIsA}
              allowTie
              tieLabel="Tie"
            />
          </ActionForm>
        </>
      )}
    </div>
  );
}
