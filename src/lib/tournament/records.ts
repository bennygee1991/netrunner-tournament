import { eventResults, standings } from "@/engine";
import type { Prisma } from "@/generated/prisma/client";
import type { LoadedEvent } from "./state";

/** Removes the permanent records and trophies of an event (used when it is reopened or reset). */
export async function clearOutcome(tx: Prisma.TransactionClient, eventId: string) {
  await tx.eventRecord.deleteMany({ where: { eventId } });
  await tx.trophy.deleteMany({ where: { eventId } });
}

/** Writes per-player event records and the event champion trophy for a finished event. */
export async function recordOutcome(tx: Prisma.TransactionClient, loaded: LoadedEvent, state = loaded.state) {
  const { event, nameOf } = loaded;
  await clearOutcome(tx, event.id);
  const results = eventResults(state, nameOf);
  const byId = new Map(loaded.entrants.map((e) => [e.id, e]));
  const rows = standings(state, nameOf).map((s) => {
    const r = results.get(s.id)!;
    const entrant = byId.get(s.id)!;
    return {
      eventId: event.id,
      seasonName: event.seasonName,
      eventName: event.name,
      eventDate: event.date,
      userId: entrant.userId,
      playerName: entrant.name,
      placing: r.label,
      rank: r.rank,
      points: r.points,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      champion: r.label === "Champion",
      undefeated: s.losses === 0 && s.opponents.length > 0,
    };
  });
  await tx.eventRecord.createMany({ data: rows });
  for (const r of rows.filter((x) => x.champion)) {
    await tx.trophy.create({
      data: {
        kind: "event-champion",
        userId: r.userId,
        playerName: r.playerName,
        seasonId: event.seasonId,
        seasonName: event.seasonName,
        eventId: event.id,
        eventName: event.name,
      },
    });
  }
}
