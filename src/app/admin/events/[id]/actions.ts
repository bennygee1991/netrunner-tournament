"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminActor } from "@/lib/auth/admin-action";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/forms/state";
import {
  opDrop,
  opFinish,
  opPairNext,
  opPickSides,
  opReopen,
  opResetEvent,
  opRestartRound,
  opSetResult,
  opStartCut,
  opStartSwiss,
  opUndoRound,
  opUndrop,
} from "@/lib/tournament/ops";
import {
  addPlayerByName,
  approveAllSignups,
  approveSignup,
  rejectSignup,
  removeEntrant,
} from "@/lib/tournament/registration";
import { opApproveAgreedReports } from "@/lib/tournament/reports";
import { opClock } from "@/lib/tournament/clock-ops";
import { deleteOneOffEvent } from "@/lib/tournament/one-off";
import { cryptoRng } from "@/lib/tournament/rng";
import { updateEventSetup } from "@/lib/tournament/season";

function refresh(eventId: string) {
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/admin/season");
  revalidatePath("/");
}

type Res =
  { ok: true; message?: string } | { ok: false; error?: string; fieldErrors?: FormState["fieldErrors"] };

async function finish(eventId: string, res: Res, okMessage?: string): Promise<FormState> {
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  refresh(eventId);
  return { message: ("message" in res && res.message) || okMessage };
}

export async function setupAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  const input = {
    name: str(form, "name"),
    date: str(form, "date"),
    month: str(form, "month"),
    matchFormat: str(form, "matchFormat"),
    swissRounds: str(form, "swissRounds"),
    cutSize: str(form, "cutSize"),
    startTime: str(form, "startTime"),
    venue: str(form, "venue"),
    notes: str(form, "notes"),
    finale: form.get("finale") === "on",
    cutFormat: str(form, "cutFormat") || undefined,
  };
  const res = await updateEventSetup(db, actor, eventId, input);
  return finish(eventId, res, "Event saved.");
}

export async function approveAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(eventId, await approveSignup(db, actor, eventId, str(form, "userId")));
}

export async function rejectAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(eventId, await rejectSignup(db, actor, eventId, str(form, "userId")));
}

export async function approveAllAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(eventId, await approveAllSignups(db, actor, eventId));
}

export async function addPlayerAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(eventId, await addPlayerByName(db, actor, eventId, str(form, "name")));
}

export async function removeEntrantAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(eventId, await removeEntrant(db, actor, eventId, str(form, "entrantId")));
}

export async function startSwissAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(eventId, await opStartSwiss(db, actor, eventId, cryptoRng, str(form, "version")));
}

export async function pairNextAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(eventId, await opPairNext(db, actor, eventId, cryptoRng, str(form, "version")));
}

export async function startCutAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(eventId, await opStartCut(db, actor, eventId, cryptoRng, str(form, "version")));
}

export async function finishAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(eventId, await opFinish(db, actor, eventId, str(form, "version")));
}

export async function resultAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  const input = {
    phase: str(form, "phase"),
    round: str(form, "round"),
    match: str(form, "match"),
    game: str(form, "game"),
    result: str(form, "result"),
    a: str(form, "a"),
    b: str(form, "b"),
  };
  return finish(eventId, await opSetResult(db, actor, eventId, input, cryptoRng));
}

// ------------------------------------------------------------------ repair tools

export async function restartRoundAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  const res = await opRestartRound(db, actor, eventId, str(form, "phase"), cryptoRng, str(form, "version"));
  return finish(eventId, res, "Round re-paired.");
}

export async function undoRoundAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  const res = await opUndoRound(db, actor, eventId, str(form, "phase"), str(form, "version"));
  return finish(eventId, res, "Round undone.");
}

export async function reopenAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  const res = await finish(eventId, await opReopen(db, actor, eventId, str(form, "version")));
  if (res.error) return res;
  redirect(`/admin/events/${eventId}?notice=event-reopened`);
}

export async function resetEventAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  const res = await finish(eventId, await opResetEvent(db, actor, eventId, str(form, "confirm")));
  if (res.error) return res;
  redirect(`/admin/events/${eventId}?notice=event-reset`);
}

export async function dropAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(eventId, await opDrop(db, actor, eventId, str(form, "entrantId")));
}

export async function undropAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(eventId, await opUndrop(db, actor, eventId, str(form, "entrantId")));
}

export async function approveReportsAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  return finish(
    eventId,
    await opApproveAgreedReports(db, actor, eventId, cryptoRng, str(form, "version")),
    "Reported results approved.",
  );
}

export async function pickSidesAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  const res = await opPickSides(db, actor, eventId, {
    round: str(form, "round"),
    match: str(form, "match"),
    corpId: str(form, "corpId"),
  });
  return finish(eventId, res, "Sides set.");
}

export async function deleteOneOffAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  const res = await deleteOneOffEvent(db, actor, eventId, str(form, "confirm"));
  if (!res.ok) return { error: res.error };
  revalidatePath("/events");
  revalidatePath("/admin/events");
  revalidatePath("/");
  redirect("/admin/events?notice=event-deleted");
}

export async function clockAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const eventId = str(form, "eventId");
  const res = await opClock(db, actor, eventId, {
    target: str(form, "target"),
    match: str(form, "match") || undefined,
    op: str(form, "op"),
  });
  if (!res.ok) return { error: res.error };
  refresh(eventId);
  return {};
}
