import { describe, expect, it } from "vitest";
import { BADGES, type BadgeRecord, computeBadges, playerEventFacts } from "./badges";
import { newEvent } from "./event";
import { byId, match, round } from "./test-helpers";

const rec = (over: Partial<BadgeRecord> & { eventKey: string }): BadgeRecord => ({
  seasonKey: "S1",
  rank: 5,
  champion: false,
  undefeated: false,
  wins: 1,
  draws: 0,
  losses: 1,
  madeCut: false,
  cutSeed: null,
  cutSize: null,
  cutDraws: 0,
  cutLosses: 0,
  lostFirstRound: false,
  corpWins: 0,
  runnerWins: 0,
  opponentIds: [],
  ...over,
});

const keys = (
  records: BadgeRecord[],
  extra: { seasonTitles?: number; reportsApproved?: number } = {},
  order?: string[],
) =>
  computeBadges(
    { records, seasonTitles: extra.seasonTitles ?? 0, reportsApproved: extra.reportsApproved ?? 0 },
    {
      eventOrder: order ?? records.map((r) => r.eventKey),
      seasonOrder: [...new Set(records.map((r) => r.seasonKey))],
    },
  );

describe("badge definitions", () => {
  it("have unique keys and no organizer awards", () => {
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(BADGES.length);
    expect(BADGES.every((b) => b.icon && b.label && b.description)).toBe(true);
  });
});

describe("playerEventFacts", () => {
  it("counts side wins, opponents, round-1 losses and cut seeds", () => {
    // Single-sided Swiss: corp is side a unless stated.
    const ev = newEvent({
      id: "e",
      status: "done",
      cutSize: 4,
      entrants: ["a", "b", "c", "d", "e"],
      rounds: [
        round(match("a", "b", "B"), match("c", "d", "A", "b"), match("e", null)),
        round(match("b", "c", "A"), match("a", "e", "A"), match("d", null)),
      ],
    });
    const facts0 = playerEventFacts(ev, byId);
    expect(facts0.get("a")).toMatchObject({
      lostFirstRound: true,
      corpWins: 1,
      runnerWins: 0,
      madeCut: false,
    });
    expect(facts0.get("b")).toMatchObject({ lostFirstRound: false, corpWins: 1, runnerWins: 1 });
    // c was the Runner (corp = b side = d) and won.
    expect(facts0.get("c")).toMatchObject({ runnerWins: 1, corpWins: 0 });
    expect(facts0.get("d")).toMatchObject({ lostFirstRound: true, corpWins: 0 });
    // Byes count for nothing.
    expect(facts0.get("e")).toMatchObject({ lostFirstRound: false, opponents: ["a"] });
    expect(facts0.get("b")!.opponents).toEqual(["a", "c"]);
  });

  it("swaps sides in double-sided game 2 and marks the cut", () => {
    const ev = newEvent({
      id: "e",
      status: "done",
      format: "double",
      cutSize: 4,
      entrants: ["a", "b", "c", "d"],
      rounds: [round(match("a", "b", "A", "a", "A"), match("c", "d", "D", "a", "B"))],
      cut: [round(match("a", "d", "A", "b"), match("b", "c", "D", "a")), round(match("a", "b", "B", "a"))],
    });
    const f = playerEventFacts(ev, byId);
    // a: game 1 Corp win, game 2 Runner win; cut: Runner win vs d, Corp loss in the final.
    expect(f.get("a")).toMatchObject({ corpWins: 1, runnerWins: 2, madeCut: true, cutSize: 4 });
    // c-d: game 1 tied, d won game 2 as the Corp, so c lost round 1.
    expect(f.get("d")).toMatchObject({ corpWins: 1, lostFirstRound: false });
    expect(f.get("c")!.lostFirstRound).toBe(true);
    expect(f.get("b")).toMatchObject({ cutDraws: 1, runnerWins: 1 });
    expect([...f.values()].every((x) => x.cutSeed !== null)).toBe(true);
  });
});

describe("playerEventFacts in a series cut", () => {
  it("counts games 2 and 3 with their sides, and cut losses", () => {
    const ev = newEvent({
      id: "e",
      status: "done",
      cutSize: 4,
      cutFormat: "series",
      entrants: ["a", "b", "c", "d"],
      rounds: [round(match("a", "d", "A"), match("b", "c", "A"))],
      cut: [
        round(
          // a Corp in game 1 (lost), Runner in game 2 (won), decider: corp3 = b side (d), a won as Runner.
          { a: "a", b: "d", corp: "a", g1: "B", g2: "A", g3: "A", corp3: "b" },
          { a: "b", b: "c", corp: "b", g1: "A", g2: "A", g3: null, corp3: null },
        ),
        round({ a: "a", b: "c", corp: "a", g1: "A", g2: "A", g3: null, corp3: null }),
      ],
    });
    const f = playerEventFacts(ev, byId);
    // Swiss: a won as Corp. Cut: R2 game 2 Runner, game 3 Runner; final game 1 Corp, game 2 Runner.
    expect(f.get("a")).toMatchObject({ corpWins: 2, runnerWins: 3, cutLosses: 1 });
    // d won semifinal game 1 as Runner.
    expect(f.get("d")).toMatchObject({ runnerWins: 1, cutLosses: 2 });
    // c was the Corp in semifinal game 1 and lost everything in the cut.
    expect(f.get("c")).toMatchObject({ cutLosses: 4, corpWins: 0 });
  });
});

describe("computeBadges", () => {
  it("climbs the attendance ladder at the right event", () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      rec({ eventKey: `e${i}`, seasonKey: `S${Math.floor(i / 4)}` }),
    );
    const got = keys(records);
    const at = Object.fromEntries(got.map((b) => [b.key, b.eventKey]));
    expect(at["first-event"]).toBe("e0");
    expect(at["five-events"]).toBe("e4");
    expect(at["ten-events"]).toBe("e9");
    expect(at["twentyfive-events"]).toBeUndefined();
    expect(at["full-season"]).toBe("e3");
    expect(at["ironman"]).toBe("e7");
    expect(at["early-adopter"]).toBe("e0");
  });

  it("needs two seasons in a row for Ironman", () => {
    const s = (k: string, n: number) =>
      Array.from({ length: n }, (_, i) => rec({ eventKey: `${k}${i}`, seasonKey: k }));
    const records = [...s("A", 4), ...s("B", 3), ...s("C", 4)];
    const got = computeBadges(
      { records, seasonTitles: 0, reportsApproved: 0 },
      { eventOrder: records.map((r) => r.eventKey), seasonOrder: ["A", "B", "C"] },
    ).map((b) => b.key);
    expect(got).toContain("full-season");
    expect(got).not.toContain("ironman");
  });

  it("awards early adopter only for the league's first season", () => {
    const got = computeBadges(
      { records: [rec({ eventKey: "x", seasonKey: "S2" })], seasonTitles: 0, reportsApproved: 0 },
      { eventOrder: ["first", "x"], seasonOrder: ["S1", "S2"] },
    ).map((b) => b.key);
    expect(got).not.toContain("early-adopter");
  });

  it("tracks cuts, finals, comebacks, flawless Swiss and ties", () => {
    const records = [
      rec({ eventKey: "e1", madeCut: true, rank: 3, lostFirstRound: true }),
      rec({ eventKey: "e2", madeCut: true, rank: 2, undefeated: true, losses: 0 }),
      rec({ eventKey: "e3", madeCut: true, rank: 5, draws: 2, cutDraws: 1 }),
    ];
    const got = keys(records).map((b) => b.key);
    expect(got).toEqual(
      expect.arrayContaining([
        "made-cut",
        "cut-regular",
        "finalist",
        "comeback",
        "undefeated-swiss",
        "diplomat",
      ]),
    );
    expect(got).not.toContain("cut-machine");
  });

  it("does not give a comeback without making the cut", () => {
    expect(keys([rec({ eventKey: "e", lostFirstRound: true })]).map((b) => b.key)).not.toContain("comeback");
  });

  it("awards back-to-back only for consecutive league events", () => {
    const win = (k: string) => rec({ eventKey: k, champion: true, rank: 1 });
    const consecutive = keys([win("e1"), win("e2")], {}, ["e1", "e2"]).map((b) => b.key);
    expect(consecutive).toContain("back-to-back");
    // Someone else won e2 (the player skipped it or lost).
    const gap = keys([win("e1"), win("e3")], {}, ["e1", "e2", "e3"]).map((b) => b.key);
    expect(gap).not.toContain("back-to-back");
  });

  it("awards perfect events and underdogs", () => {
    const perfect = rec({
      eventKey: "p",
      champion: true,
      rank: 1,
      madeCut: true,
      losses: 0,
      draws: 0,
      cutSeed: 2,
      cutSize: 8,
    });
    expect(keys([perfect]).map((b) => b.key)).toContain("perfect-event");
    expect(keys([{ ...perfect, cutDraws: 1 }]).map((b) => b.key)).not.toContain("perfect-event");
    // Won the series cut but dropped a game on the way.
    expect(keys([{ ...perfect, cutLosses: 1 }]).map((b) => b.key)).not.toContain("perfect-event");
    // A Swiss-only win is not perfect (there was no cut to win).
    expect(keys([{ ...perfect, madeCut: false }]).map((b) => b.key)).not.toContain("perfect-event");
    const under = rec({ eventKey: "u", champion: true, rank: 1, madeCut: true, cutSeed: 8, cutSize: 8 });
    expect(keys([under]).map((b) => b.key)).toContain("underdog");
    expect(keys([{ ...under, cutSeed: 7 }]).map((b) => b.key)).not.toContain("underdog");
  });

  it("counts side wins across events and needs both sides for Balanced", () => {
    const records = [
      rec({ eventKey: "a", corpWins: 6, runnerWins: 9 }),
      rec({ eventKey: "b", corpWins: 6, runnerWins: 0 }),
    ];
    const got = Object.fromEntries(keys(records).map((b) => [b.key, b.eventKey]));
    expect(got["corp-10"]).toBe("b");
    expect(got["runner-10"]).toBeUndefined();
    expect(got["balanced"]).toBeUndefined();
    const more = [...records, rec({ eventKey: "c", runnerWins: 1 })];
    expect(Object.fromEntries(keys(more).map((b) => [b.key, b.eventKey]))["balanced"]).toBe("c");
  });

  it("counts distinct registered opponents for Mentor", () => {
    const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => `u${from + i}`);
    const got = keys([
      rec({ eventKey: "a", opponentIds: ids(0, 12) }),
      rec({ eventKey: "b", opponentIds: ids(6, 12) }),
    ]);
    expect(got.find((b) => b.key === "mentor")?.eventKey).toBeUndefined(); // 18 distinct
    const more = keys([
      rec({ eventKey: "a", opponentIds: ids(0, 12) }),
      rec({ eventKey: "b", opponentIds: ids(10, 10) }),
    ]);
    expect(more.find((b) => b.key === "mentor")?.eventKey).toBe("b"); // 20 distinct
  });

  it("awards Dynasty and Reporter without an event", () => {
    const got = keys([], { seasonTitles: 2, reportsApproved: 10 });
    expect(got).toEqual([
      { key: "dynasty", eventKey: null },
      { key: "reporter", eventKey: null },
    ]);
    expect(keys([], { seasonTitles: 1, reportsApproved: 9 })).toEqual([]);
  });
});
