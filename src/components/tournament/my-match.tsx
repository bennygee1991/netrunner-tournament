"use client";

import { ActionForm } from "@/components/action-form";
import { Card, CardTitle, cx } from "@/components/ui";
import { pickSidesAction, reportResultAction } from "@/app/events/[id]/actions";

type Outcome = "win" | "tie" | "loss";

export interface MyMatchProps {
  eventId: string;
  phase: "swiss" | "cut";
  round: number;
  match: number;
  roundLabel: string;
  table: number;
  opponent: string;
  /** Series cut match (games 1-2 plus a decider). */
  series: boolean;
  /** Series cut, sides not picked yet: whether I am the higher seed who picks. */
  sides?: { iPick: boolean; pickerName: string; meId: string; opponentId: string };
  /** Per open game: my side and what I reported so far. */
  games: {
    game: 1 | 2 | 3;
    mySide: "Corp" | "Runner" | null;
    myReport: Outcome | null;
    opponentReported: boolean;
    agrees: boolean | null;
  }[];
}

const LABEL: Record<Outcome, string> = { win: "I won", tie: "Tie", loss: "I lost" };

/** "Your match": the signed-in player reports their own result for the organizer to approve. */
export function MyMatch(p: MyMatchProps) {
  return (
    <Card tone="magenta">
      <CardTitle>Your match</CardTitle>
      <p className="mb-3">
        {p.roundLabel} · {p.series ? "match" : "table"} {p.table} · vs{" "}
        <span className="font-semibold">{p.opponent}</span>
      </p>
      {p.sides &&
        (p.sides.iPick ? (
          <div className="mb-2">
            <p className="mb-2 text-sm">
              You are the higher seed: pick your side for game 1. You swap for game 2, and a coin flip sets
              sides for game 3 if it&apos;s needed.
            </p>
            <ActionForm
              action={pickSidesAction}
              fields={{ eventId: p.eventId, round: p.round, match: p.match }}
            >
              <div className="flex gap-2" role="group" aria-label="Pick your side for game 1">
                <button
                  type="submit"
                  name="corpId"
                  value={p.sides.meId}
                  className="min-h-11 flex-1 rounded border border-magenta px-2 font-mono text-sm font-bold text-magenta uppercase"
                >
                  Corp first
                </button>
                <button
                  type="submit"
                  name="corpId"
                  value={p.sides.opponentId}
                  className="min-h-11 flex-1 rounded border border-cyan px-2 font-mono text-sm font-bold text-cyan uppercase"
                >
                  Runner first
                </button>
              </div>
            </ActionForm>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Waiting for {p.sides.pickerName} (the higher seed) to pick sides for game 1.
          </p>
        ))}
      {p.games.map((g) => (
        <div key={g.game} className="mb-4 last:mb-0">
          {p.series || p.games.length > 1 || g.game === 2 ? (
            <p className="mb-1 font-mono text-xs tracking-widest text-muted uppercase">
              Game {g.game}
              {g.game === 3 && " · decider, sides by coin flip"}
            </p>
          ) : null}
          {g.mySide && (
            <p className="mb-2 text-sm">
              You play{" "}
              <span
                className={cx(
                  "font-mono font-bold uppercase",
                  g.mySide === "Corp" ? "text-magenta" : "text-cyan",
                )}
              >
                {g.mySide}
              </span>
            </p>
          )}
          <ActionForm
            action={reportResultAction}
            fields={{ eventId: p.eventId, phase: p.phase, round: p.round, match: p.match, game: g.game }}
          >
            <div className="flex gap-2" role="group" aria-label={`Report game ${g.game}`}>
              {(p.phase === "cut" ? (["win", "loss"] as const) : (["win", "tie", "loss"] as const)).map(
                (o) => (
                  <button
                    key={o}
                    type="submit"
                    name="outcome"
                    value={o}
                    aria-pressed={g.myReport === o}
                    className={cx(
                      "min-h-11 flex-1 rounded border px-2 font-mono text-sm font-bold uppercase",
                      g.myReport === o
                        ? "border-cyan bg-cyan text-accent-fg"
                        : "border-border hover:border-cyan",
                    )}
                  >
                    {LABEL[o]}
                  </button>
                ),
              )}
            </div>
          </ActionForm>
          <p className="mt-2 text-xs text-muted" aria-live="polite">
            {g.myReport ? `You reported: ${LABEL[g.myReport].toLowerCase()}. ` : "Not reported yet. "}
            {g.opponentReported
              ? g.agrees === false
                ? "Your opponent reported something different; the organizer will decide."
                : "Your opponent reported too. "
              : "Waiting for your opponent. "}
            Results count once the organizer approves them.
          </p>
        </div>
      ))}
    </Card>
  );
}
