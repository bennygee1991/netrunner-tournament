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
          current && !on && "border-dashed text-muted",
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

/** Series cut: the higher seed's choice of sides for game 1 (the organizer can enter it for them). */
export function SidePicker({
  action,
  eventId,
  round,
  match,
  intro,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  eventId: string;
  round: number;
  match: MatchView;
  intro: string;
}) {
  if (!match.b || !match.series) return null;
  const picker = match.series.pickerId === match.a.id ? match.a : match.b;
  const other = picker.id === match.a.id ? match.b : match.a;
  const chosen = match.corpId;
  const btn = (corpId: string, label: string) => (
    <button
      type="submit"
      name="corpId"
      value={corpId}
      aria-pressed={chosen === corpId}
      className={cx(
        "min-h-11 flex-1 rounded border px-2 py-1 text-sm",
        chosen === corpId ? "border-cyan bg-cyan/10 text-cyan" : "border-border hover:border-cyan",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-1">
      <p className="text-sm">{intro.replace("{picker}", picker.name)}</p>
      <ActionForm action={action} fields={{ eventId, round, match: match.index }} showMessage={false}>
        <div className="flex gap-2">
          {btn(picker.id, `${picker.name} plays Corp first`)}
          {btn(other.id, `${picker.name} plays Runner first`)}
        </div>
      </ActionForm>
    </div>
  );
}

/** Tap the winner (or tie). Tapping the chosen result again clears it. */
export function ResultEntry({
  action,
  sidesAction,
  eventId,
  phase,
  round,
  match,
  double,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  /** Series cut matches: sets sides for game 1. */
  sidesAction?: (s: FormState, f: FormData) => Promise<FormState>;
  eventId: string;
  phase: "swiss" | "cut";
  round: number;
  match: MatchView;
  double: boolean;
}) {
  if (!match.b) return null;
  if (match.series) return <SeriesEntry {...{ action, sidesAction, eventId, round, match }} />;
  const corpIsA = match.corpId === null ? null : match.corpId === match.a.id;
  const base = { eventId, phase, round, match: match.index, a: match.a.id, b: match.b.id };
  const tieLabel = phase === "cut" ? "Tie*" : "Tie";
  const describe = (r: "A" | "B" | "D") =>
    r === "D" ? "tie" : `${r === "A" ? match.a.name : match.b!.name} won`;
  const reportLine = (game: 1 | 2 | 3) => {
    const reports = match.reports?.reports.filter((r) => r.game === game) ?? [];
    if (!reports.length) return null;
    const status = match.reports?.status[game];
    return (
      <p className={cx("font-mono text-xs", status === "conflict" ? "text-danger" : "text-warn")}>
        {status === "conflict" ? "⚠ Players disagree: " : "Reported: "}
        {reports.map((r) => `${r.reporterName} says ${describe(r.result)}`).join(" · ")}
        {status && status !== "conflict" && " · tap that result to approve"}
      </p>
    );
  };
  return (
    <div className="space-y-1 py-2" data-testid={`match-${phase}-${round}-${match.index}`}>
      <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
        Table {match.index + 1}
        {double && " · Game 1"}
      </p>
      <ActionForm action={action} fields={{ ...base, game: 1 }} showMessage={false}>
        <Buttons match={match} current={match.g1} corpIsA={corpIsA} allowTie tieLabel={tieLabel} />
      </ActionForm>
      {match.g1 === null && reportLine(1)}
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
          {match.g2 === null && reportLine(2)}
        </>
      )}
    </div>
  );
}

function SeriesEntry({
  action,
  sidesAction,
  eventId,
  round,
  match,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  sidesAction?: (s: FormState, f: FormData) => Promise<FormState>;
  eventId: string;
  round: number;
  match: MatchView;
}) {
  const s = match.series!;
  const base = { eventId, phase: "cut", round, match: match.index, a: match.a.id, b: match.b!.id };
  const describe = (r: "A" | "B" | "D") =>
    r === "D" ? "tie" : `${r === "A" ? match.a.name : match.b!.name} won`;
  const reportLine = (game: 1 | 2 | 3) => {
    const reports = match.reports?.reports.filter((r) => r.game === game) ?? [];
    if (!reports.length) return null;
    const status = match.reports?.status[game];
    return (
      <p className={cx("font-mono text-xs", status === "conflict" ? "text-danger" : "text-warn")}>
        {status === "conflict" ? "⚠ Players disagree: " : "Reported: "}
        {reports.map((r) => `${r.reporterName} says ${describe(r.result)}`).join(" · ")}
        {status && status !== "conflict" && " · tap that result to approve"}
      </p>
    );
  };
  const corpIsA = match.corpId === null ? null : match.corpId === match.a.id;
  const noGames = match.g1 === null && match.g2 === null;
  const winner = s.winnerId ? (s.winnerId === match.a.id ? match.a.name : match.b!.name) : null;
  return (
    <div className="space-y-1 py-2" data-testid={`match-cut-${round}-${match.index}`}>
      <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
        Match {match.index + 1} · 2 games + decider
      </p>
      {corpIsA === null ? (
        sidesAction ? (
          <SidePicker
            action={sidesAction}
            eventId={eventId}
            round={round}
            match={match}
            intro="{picker} is the higher seed and picks sides for game 1 (enter it for them if needed)."
          />
        ) : (
          <p className="text-sm text-muted">Waiting for the higher seed to pick sides.</p>
        )
      ) : (
        <>
          <p className="font-mono text-[11px] tracking-widest text-muted uppercase">Game 1</p>
          <ActionForm action={action} fields={{ ...base, game: 1 }} showMessage={false}>
            <Buttons match={match} current={match.g1} corpIsA={corpIsA} allowTie tieLabel="Tie" />
          </ActionForm>
          {match.g1 === null && reportLine(1)}
          <p className="font-mono text-[11px] tracking-widest text-muted uppercase">Game 2 · sides swap</p>
          <ActionForm action={action} fields={{ ...base, game: 2 }} showMessage={false}>
            <Buttons match={match} current={match.g2} corpIsA={!corpIsA} allowTie tieLabel="Tie" />
          </ActionForm>
          {match.g2 === null && reportLine(2)}
          {s.decider && (
            <>
              <p className="font-mono text-[11px] tracking-widest text-warn uppercase">
                Game 3 · decider · sides by coin flip
              </p>
              <ActionForm action={action} fields={{ ...base, game: 3 }} showMessage={false}>
                <Buttons
                  match={match}
                  current={s.g3}
                  corpIsA={s.corp3Id === null ? null : s.corp3Id === match.a.id}
                  allowTie
                  tieLabel="Tie*"
                />
              </ActionForm>
              {s.g3 === null && reportLine(3)}
            </>
          )}
          {winner && <p className="font-mono text-xs text-ok">{winner} wins the match</p>}
          {noGames && sidesAction && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted">Change sides</summary>
              <div className="mt-1">
                <SidePicker
                  action={sidesAction}
                  eventId={eventId}
                  round={round}
                  match={match}
                  intro="Sides can change until a game result is in."
                />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
