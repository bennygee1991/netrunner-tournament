import { eventResults, playerEventFacts, standings } from "@/engine";
import type { Prisma } from "@/generated/prisma/client";
import type { LoadedEvent } from "./state";

/** Removes the permanent records and trophies of an event (used when it is reopened or reset). */
export async function clearOutcome(tx: Prisma.TransactionClient, eventId: string) {
  await tx.eventRecord.deleteMany({ where: { eventId } });
  await tx.trophy.deleteMany({ where: { eventId } });
}

/**
 * Writes per-player event records (with the facts badges need) and the event champion trophy for
 * a finished event, plus the finale champion trophy for a season finale.
 */
export async function recordOutcome(tx: Prisma.TransactionClient, loaded: LoadedEvent, state = loaded.state) {
  const { event, nameOf } = loaded;
  await clearOutcome(tx, event.id);
  const results = eventResults(state, nameOf);
  const facts = playerEventFacts(state, nameOf);
  const byId = new Map(loaded.entrants.map((e) => [e.id, e]));
  const rows = standings(state, nameOf).map((s) => {
    const r = results.get(s.id)!;
    const entrant = byId.get(s.id)!;
    const f = facts.get(s.id)!;
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
      eventKey: event.id,
      seasonId: event.seasonId,
      finale: event.finale,
      madeCut: f.madeCut,
      cutSeed: f.cutSeed,
      cutSize: f.cutSize,
      cutDraws: f.cutDraws,
      cutLosses: f.cutLosses,
      lostFirstRound: f.lostFirstRound,
      corpWins: f.corpWins,
      runnerWins: f.runnerWins,
      opponentIds: f.opponents.map((o) => byId.get(o)?.userId).filter((u): u is string => !!u),
      statsVersion: 2,
    };
  });
  await tx.eventRecord.createMany({ data: rows });
  for (const r of rows.filter((x) => x.champion)) {
    for (const kind of event.finale ? ["event-champion", "finale-champion"] : ["event-champion"])
      await tx.trophy.create({
        data: {
          kind,
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
