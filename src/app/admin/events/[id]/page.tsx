import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { MatchCard } from "@/components/tournament/match-card";
import { ResultEntry } from "@/components/tournament/result-entry";
import { ResultsTable } from "@/components/tournament/results-table";
import { StandingsTable } from "@/components/tournament/standings-table";
import { EventStatusBadge, formatLine } from "@/components/tournament/status-badge";
import { TypedConfirmForm } from "@/components/typed-confirm";
import { Card, CardTitle, Field, PageTitle, buttonStyles } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDay, toIsoDate } from "@/lib/tournament/dates";
import { type EventView, getEventView } from "@/lib/tournament/queries";
import {
  addPlayerAction,
  approveAction,
  approveAllAction,
  dropAction,
  finishAction,
  pairNextAction,
  rejectAction,
  removeEntrantAction,
  reopenAction,
  resetEventAction,
  restartRoundAction,
  resultAction,
  startCutAction,
  startSwissAction,
  undoRoundAction,
  undropAction,
} from "./actions";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Run event" };

function NextStepCard({ view }: { view: EventView }) {
  const { meta, nextStep } = view;
  const fields = { eventId: meta.id, version: meta.version };
  const entrants = view.entrants.length;
  let content: React.ReactNode;
  switch (nextStep) {
    case "start-swiss":
      content = (
        <ActionForm action={startSwissAction} fields={fields}>
          <p className="mb-3 text-sm text-muted">
            {entrants} entrant{entrants === 1 ? "" : "s"} ·{" "}
            {meta.swissRounds ?? `auto (${meta.effectiveSwissRounds})`} Swiss rounds ·{" "}
            {meta.cutSize ? `top ${meta.cutSize} cut (shrinks to fit the field)` : "no cut"}. Round 1 is
            paired at random.
          </p>
          <SubmitButton disabled={entrants < 2} pendingText="Pairing…">
            Start Swiss
          </SubmitButton>
          {entrants < 2 && <p className="mt-2 text-sm text-muted">Add at least 2 entrants first.</p>}
        </ActionForm>
      );
      break;
    case "pair-next":
      content = (
        <ActionForm action={pairNextAction} fields={fields}>
          <SubmitButton pendingText="Pairing…">Pair round {view.swiss.length + 1}</SubmitButton>
        </ActionForm>
      );
      break;
    case "start-cut":
      content = (
        <ActionForm action={startCutAction} fields={fields}>
          <SubmitButton pendingText="Seeding…">Start top {meta.cutSize} cut</SubmitButton>
        </ActionForm>
      );
      break;
    case "finish":
      content = (
        <ActionForm action={finishAction} fields={fields}>
          <SubmitButton pendingText="Finishing…">Finish event</SubmitButton>
        </ActionForm>
      );
      break;
    case "report-results":
      content = (
        <p className="text-sm text-muted">
          {meta.status === "CUT"
            ? "Report the cut results. The next cut round (or the title) is set automatically."
            : "Report every result in the current round to continue."}
        </p>
      );
      break;
    case "done":
      content = <p className="text-sm text-ok">Event finished. Points are on the leaderboards.</p>;
  }
  return (
    <Card tone="magenta">
      <CardTitle>Next step</CardTitle>
      {content}
    </Card>
  );
}

function Rounds({ view, repair }: { view: EventView; repair: boolean }) {
  const double = view.meta.matchFormat === "DOUBLE";
  const swissLive = view.meta.status === "SWISS";
  const cutLive = view.meta.status === "CUT";
  const lastSwiss = view.swiss.length - 1;
  const lastCut = view.cut.length - 1;
  return (
    <>
      {view.cut.length > 0 && (
        <Card tone="warn">
          <CardTitle>Top cut · single games</CardTitle>
          {[...view.cut].reverse().map((r) => (
            <section key={r.index} className="mb-3">
              <h3 className="mb-1 font-mono text-sm tracking-widest text-magenta uppercase">{r.label}</h3>
              {r.matches.map((m) =>
                cutLive && r.index === lastCut ? (
                  <ResultEntry
                    key={m.index}
                    action={resultAction}
                    eventId={view.meta.id}
                    phase="cut"
                    round={r.index}
                    match={m}
                    double={false}
                  />
                ) : (
                  <MatchCard key={m.index} match={m} double={false} />
                ),
              )}
            </section>
          ))}
          {cutLive && <p className="text-xs text-muted">*A tied cut game advances the higher seed.</p>}
        </Card>
      )}
      {view.swiss.length > 0 && (
        <Card>
          <CardTitle>
            Swiss · {view.swiss.length} of {view.meta.effectiveSwissRounds} rounds
          </CardTitle>
          {swissLive && view.swiss.length > 1 && (
            <p className="mb-3 text-sm">
              {repair ? (
                <>
                  <span className="text-warn">Repair mode is on:</span> earlier rounds are open below. Fixing
                  a result updates the standings at once; existing pairings stay as they are.{" "}
                  <Link href={`/admin/events/${view.meta.id}`} className={buttonStyles.link}>
                    Turn off
                  </Link>
                </>
              ) : (
                <Link href={`/admin/events/${view.meta.id}?repair=1`} className={buttonStyles.link}>
                  Repair an earlier round&apos;s results
                </Link>
              )}
            </p>
          )}
          {[...view.swiss].reverse().map((r) =>
            swissLive && (r.index === lastSwiss || repair) ? (
              <section key={r.index} className="mb-3">
                <h3 className="mb-1 font-mono text-sm tracking-widest text-magenta uppercase">
                  {r.label} · {r.complete ? "all reported" : "in progress"}
                </h3>
                {r.matches.map((m) =>
                  m.b ? (
                    <ResultEntry
                      key={m.index}
                      action={resultAction}
                      eventId={view.meta.id}
                      phase="swiss"
                      round={r.index}
                      match={m}
                      double={double}
                    />
                  ) : (
                    <MatchCard key={m.index} match={m} double={double} />
                  ),
                )}
              </section>
            ) : (
              <details key={r.index} className="border-t border-border py-2">
                <summary className="cursor-pointer font-mono text-sm tracking-widest text-muted uppercase">
                  {r.label}
                </summary>
                {r.matches.map((m) => (
                  <MatchCard key={m.index} match={m} double={double} table={m.b ? m.index + 1 : undefined} />
                ))}
              </details>
            ),
          )}
        </Card>
      )}
    </>
  );
}

function Registrations({ view }: { view: EventView }) {
  const { meta } = view;
  const canAdd = meta.status === "SIGNUP" || meta.status === "SWISS";
  const canDrop = meta.status === "SWISS" || meta.status === "CUT";
  if (!canAdd && !canDrop) return null;
  const fields = { eventId: meta.id };
  return (
    <Card>
      <CardTitle>Players</CardTitle>
      {meta.status === "SWISS" && (
        <p className="mb-3 text-sm text-muted">
          Late players join the next pairing with zero points (restart the round to include them now). Dropped
          players are left out of future pairings and the cut but stay in the standings.
        </p>
      )}
      {canAdd && (
        <h3 className="mb-2 font-mono text-xs tracking-widest text-muted uppercase">
          Pending sign-ups ({view.pending.length})
        </h3>
      )}
      {!canAdd ? null : view.pending.length === 0 ? (
        <p className="mb-4 text-sm text-muted">No pending sign-ups.</p>
      ) : (
        <>
          <ul className="mb-3 divide-y divide-border">
            {view.pending.map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1 font-semibold">{p.runnerName}</span>
                <ActionForm
                  action={approveAction}
                  fields={{ ...fields, userId: p.userId }}
                  showMessage={false}
                >
                  <button
                    type="submit"
                    className={buttonStyles.secondary}
                    aria-label={`Approve ${p.runnerName}`}
                  >
                    Approve
                  </button>
                </ActionForm>
                <ActionForm
                  action={rejectAction}
                  fields={{ ...fields, userId: p.userId }}
                  showMessage={false}
                >
                  <button type="submit" className={buttonStyles.danger} aria-label={`Reject ${p.runnerName}`}>
                    Reject
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
          <ActionForm action={approveAllAction} fields={fields} className="mb-4">
            <SubmitButton variant="secondary" pendingText="Approving…">
              Approve all ({view.pending.length})
            </SubmitButton>
          </ActionForm>
        </>
      )}

      <h3 className="mb-2 font-mono text-xs tracking-widest text-muted uppercase">
        Entrants ({view.entrants.length})
      </h3>
      <ul className="mb-4 flex flex-wrap gap-2">
        {view.entrants.map((e) => (
          <li
            key={e.id}
            className={`flex items-center gap-1 rounded border px-2 py-1 ${e.dropped ? "border-border opacity-70" : "border-cyan"}`}
          >
            <span className={e.dropped ? "line-through" : undefined}>{e.name}</span>
            {!e.userId && <span className="font-mono text-[10px] text-muted uppercase">guest</span>}
            {e.dropped && <span className="font-mono text-[10px] text-danger uppercase">dropped</span>}
            {canDrop && (
              <ActionForm
                action={e.dropped ? undropAction : dropAction}
                fields={{ ...fields, entrantId: e.id }}
                showMessage={false}
              >
                <button
                  type="submit"
                  className={e.dropped ? "px-1 text-cyan" : "px-1 text-danger"}
                  aria-label={e.dropped ? `Re-add ${e.name}` : `Drop ${e.name}`}
                  title={e.dropped ? "Re-add" : "Drop"}
                >
                  {e.dropped ? "↩" : "✕"}
                </button>
              </ActionForm>
            )}
            {meta.status === "SIGNUP" && (
              <ActionForm
                action={removeEntrantAction}
                fields={{ ...fields, entrantId: e.id }}
                showMessage={false}
              >
                <button type="submit" className="px-1 text-danger" aria-label={`Remove ${e.name}`}>
                  ✕
                </button>
              </ActionForm>
            )}
          </li>
        ))}
      </ul>

      {canAdd && (
        <ActionForm action={addPlayerAction} fields={fields}>
          <Field
            id="add-player"
            label="Add player"
            name="name"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="Runner name or walk-in name"
            hint="An existing account is added as itself; any other name is added as a walk-in guest."
          />
          <SubmitButton variant="secondary" pendingText="Adding…">
            Add
          </SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}

function RepairCard({ view }: { view: EventView }) {
  const { meta } = view;
  if (meta.status === "SIGNUP") return null;
  const fields = { eventId: meta.id, version: meta.version };
  const phase = meta.status === "CUT" ? "cut" : "swiss";
  const live = meta.status === "SWISS" || meta.status === "CUT";
  const roundName = phase === "cut" ? (view.cut.at(-1)?.label ?? "cut round") : `round ${view.swiss.length}`;
  return (
    <Card tone="danger">
      <CardTitle>Fix mistakes</CardTitle>
      {live && (
        <div className="mb-4 space-y-3">
          <ActionForm action={restartRoundAction} fields={{ ...fields, phase }}>
            <p className="mb-2 text-sm text-muted">
              Restart {roundName}: discard its pairings and results and pair again (includes late players,
              leaves out drops).
            </p>
            <ConfirmSubmit>Restart {roundName}</ConfirmSubmit>
          </ActionForm>
          <ActionForm action={undoRoundAction} fields={{ ...fields, phase }}>
            <p className="mb-2 text-sm text-muted">
              Undo {roundName}: remove it entirely
              {phase === "swiss" && view.swiss.length === 1 ? " (back to sign-up)" : ""}
              {phase === "cut" && view.cut.length === 1 ? " (back to Swiss)" : ""}.
            </p>
            <ConfirmSubmit>Undo {roundName}</ConfirmSubmit>
          </ActionForm>
        </div>
      )}
      {meta.status === "DONE" && (
        <ActionForm action={reopenAction} fields={fields} className="mb-4">
          <p className="mb-2 text-sm text-muted">
            Reopen the event to change results. Its league points are removed until it is finished again.
          </p>
          <ConfirmSubmit>Reopen event</ConfirmSubmit>
        </ActionForm>
      )}
      <TypedConfirmForm
        id="reset-event"
        action={resetEventAction}
        phrase={meta.name}
        fields={{ eventId: meta.id }}
        label={`Type "${meta.name}" to reset this event`}
        buttonText="Reset event"
      >
        <p className="mb-2 text-sm text-muted">
          Reset event: delete every round and result and go back to sign-up. Entrants are kept.
        </p>
      </TypedConfirmForm>
    </Card>
  );
}

export default async function AdminEventPage({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const repair = sp.repair === "1";
  const view = await getEventView(db, id);
  if (!view) notFound();
  const { meta } = view;
  const double = meta.matchFormat === "DOUBLE";

  return (
    <>
      <PageTitle kicker={`${meta.seasonName} · run event`}>{meta.name}</PageTitle>
      <div className="mb-4 flex flex-wrap items-center gap-3 font-mono text-sm text-muted">
        <EventStatusBadge status={meta.status} round={view.swiss.length} />
        <span>{formatDay(meta.date)}</span>
        <span>Month {meta.month}</span>
        <span>{formatLine(meta.matchFormat, meta.cutSize)}</span>
        <Link href={`/events/${meta.id}`} className={buttonStyles.link}>
          Public page
        </Link>
      </div>

      <Notice code={sp.notice} />
      <NextStepCard view={view} />
      <Rounds view={view} repair={repair} />

      {view.results && (
        <Card tone="warn">
          <CardTitle>League points earned</CardTitle>
          <ResultsTable results={view.results} nameOf={view.loaded.nameOf} />
        </Card>
      )}

      {view.standings.length > 0 && (
        <Card>
          <CardTitle>Standings</CardTitle>
          <StandingsTable
            standings={view.standings}
            nameOf={view.loaded.nameOf}
            cutSize={meta.cutSize}
            double={double}
            dropped={new Set(view.loaded.state.dropped)}
          />
        </Card>
      )}

      <Registrations view={view} />
      <RepairCard view={view} />

      <Card>
        <CardTitle>Event setup</CardTitle>
        <SetupForm
          event={{
            id: meta.id,
            name: meta.name,
            date: toIsoDate(meta.date),
            month: meta.month,
            matchFormat: meta.matchFormat,
            swissRounds: meta.swissRounds,
            cutSize: meta.cutSize,
          }}
          locked={meta.status !== "SIGNUP"}
          autoRounds={meta.effectiveSwissRounds}
        />
      </Card>
    </>
  );
}
