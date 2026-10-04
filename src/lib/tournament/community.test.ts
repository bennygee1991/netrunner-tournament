import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../../tests/test-db";
import { getHallOfChampions, getPlayerDirectory } from "./community";

describe.skipIf(!hasTestDb)("players directory and hall of champions (database)", () => {
  let db: PrismaClient;
  beforeAll(() => {
    db = testDb();
  });
  beforeEach(() => resetDb(db));
  afterAll(() => db.$disconnect());

  const user = (name: string, extra: object = {}) =>
    db.user.create({
      data: { runnerName: name, runnerNameLower: name.toLowerCase(), passwordHash: "x", ...extra },
    });
  const record = (userId: string | null, playerName: string, champion = false, undefeated = false) =>
    db.eventRecord.create({
      data: {
        seasonName: "S1",
        eventName: "E",
        eventDate: new Date(),
        userId,
        playerName,
        placing: champion ? "Champion" : "Rank 3",
        rank: champion ? 1 : 3,
        points: champion ? 10 : 5,
        wins: 1,
        draws: 0,
        losses: undefeated ? 0 : 1,
        champion,
        undefeated,
      },
    });

  it("lists active players with counts, searchable and sortable", async () => {
    const ada = await user("Ada", { avatar: "eye-cyan", bio: "Anarch fan", email: "ada@example.com" });
    const bob = await user("Bob");
    await user("Hidden", { disabledAt: new Date() });
    await record(ada.id, "Ada", true);
    await record(ada.id, "Ada");
    await record(bob.id, "Bob");
    await db.trophy.create({
      data: { kind: "event-champion", userId: ada.id, playerName: "Ada", seasonName: "S1", eventName: "E" },
    });

    const byName = await getPlayerDirectory(db, {});
    expect(byName.map((p) => p.runnerName)).toEqual(["Ada", "Bob"]);
    expect(byName[0]).toMatchObject({
      avatar: "eye-cyan",
      bio: "Anarch fan",
      events: 2,
      titles: 1,
      trophies: 1,
    });
    // The directory is public: it must never carry emails or password hashes.
    expect(JSON.stringify(byName)).not.toContain("ada@example.com");
    expect(byName[0]).not.toHaveProperty("email");
    expect(byName[0]).not.toHaveProperty("passwordHash");
    expect((await getPlayerDirectory(db, { sort: "events" })).map((p) => p.runnerName)).toEqual([
      "Ada",
      "Bob",
    ]);
    expect((await getPlayerDirectory(db, { q: "BO" })).map((p) => p.runnerName)).toEqual(["Bob"]);
  });

  it("groups season podiums, lists event champions and milestone holders", async () => {
    const ada = await user("Ada");
    const cy = await user("Cy Renamed");
    const season = await db.season.create({
      data: { name: "S1", startDate: new Date(), status: "ARCHIVED" },
    });
    for (const [kind, u, name] of [
      ["season-third", null, "Walk In"],
      ["season-champion", ada.id, "Ada"],
      ["season-second", cy.id, "Cy"],
    ] as const) {
      await db.trophy.create({
        data: { kind, userId: u, playerName: name, seasonId: season.id, seasonName: "S1" },
      });
    }
    await db.trophy.create({
      data: {
        kind: "event-champion",
        userId: cy.id,
        playerName: "Cy",
        seasonName: "S1",
        eventName: "Kickoff",
      },
    });
    await record(ada.id, "Ada", false, true);
    for (let i = 0; i < 10; i++) await record(cy.id, "Cy");

    const hall = await getHallOfChampions(db);
    expect(hall.seasons).toHaveLength(1);
    expect(hall.seasons[0]!.places.map((p) => [p.kind, p.player.name, p.player.profile])).toEqual([
      ["season-champion", "Ada", "Ada"],
      ["season-second", "Cy Renamed", "Cy Renamed"],
      ["season-third", "Walk In", null],
    ]);
    expect(hall.eventChampions[0]).toMatchObject({ eventName: "Kickoff", player: { name: "Cy Renamed" } });
    const holders = Object.fromEntries(hall.milestones.map((m) => [m.key, m.holders.map((h) => h.name)]));
    expect(holders).toEqual({
      "first-event": ["Ada", "Cy Renamed"],
      "ten-events": ["Cy Renamed"],
      "undefeated-swiss": ["Ada"],
    });
  });
});
