import { describe, expect, it } from "vitest";
import {
  addEntrant,
  dropEntrant,
  newEvent,
  pairNextRound,
  restartRound,
  setResult,
  startSwiss,
  undropEntrant,
} from "./event";
import { pairKey, pairRound, sideBias } from "./pairing";
import { seededRng } from "./rng";
import { standings } from "./standings";
import { byId, match, players, round, swissEvent } from "./test-helpers";
import type { EventState, Rng } from "./types";

/** Plays every open match with a random result. */
function playRound(ev: EventState, rng: Rng): EventState {
  const ri = ev.rounds.length - 1;
  ev.rounds[ri]!.matches.forEach((m, mi) => {
    if (m.b === null) return;
    const result = rng() < 0.5 ? "A" : "B";
    ev = setResult(ev, { phase: "swiss", round: ri, match: mi, game: 1, result }, byId, rng);
    if (ev.format === "double")
      ev = setResult(ev, { phase: "swiss", round: ri, match: mi, game: 2, result }, byId, rng);
  });
  return ev;
}

function pairsOf(ev: EventState): string[] {
  return ev.rounds.flatMap((r) => r.matches.filter((m) => m.b !== null).map((m) => pairKey(m.a, m.b!)));
}

describe("Swiss pairing", () => {
  it("round 1 is random", () => {
    const base = newEvent({ id: "e", entrants: players(8), cutSize: 0 });
    const first = (seed: number) =>
      startSwiss(base, byId, seededRng(seed))
        .rounds[0]!.matches.map((m) => m.a)
        .join();
    const seen = new Set([1, 2, 3, 4, 5, 6].map(first));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("never rematches when it can be avoided (8 players, 5 rounds, 200 seeds)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seededRng(seed);
      let ev = startSwiss(newEvent({ id: "e", entrants: players(8), cutSize: 0, swissRounds: 5 }), byId, rng);
      ev = playRound(ev, rng);
      for (let r = 2; r <= 5; r++) {
        ev = playRound(pairNextRound(ev, byId, rng), rng);
      }
      const pairs = pairsOf(ev);
      expect(new Set(pairs).size, `seed ${seed}`).toBe(pairs.length);
    }
  });

  it("allows a rematch only when no other pairing exists", () => {
    // 2 players, 2 rounds: the only possible pairing is a rematch.
    const ev = swissEvent(["a", "b"], [round(match("a", "b", "A"))]);
    expect(pairRound(ev, byId, seededRng(1))).toMatchObject({ mode: "allow-rematch" });
  });

  it("pairs by score: top players meet each other", () => {
    // a and c won round 1; they should meet in round 2 (no rematch with b/d needed).
    const ev = swissEvent(
      ["a", "b", "c", "d"],
      [round(match("a", "b", "A", "a"), match("c", "d", "A", "b"))],
    );
    const r2 = pairRound(ev, byId, seededRng(3)).round;
    expect(r2.matches.map((m) => pairKey(m.a, m.b!))).toContain(pairKey("a", "c"));
  });

  it("excludes dropped players from pairing", () => {
    const ev = swissEvent(
      players(5),
      [round(match("p01", "p02", "A"), match("p03", "p04", "A"), match("p05", null))],
      {
        dropped: ["p02"],
      },
    );
    const ids = pairRound(ev, byId, seededRng(1)).round.matches.flatMap((m) => [m.a, m.b]);
    expect(ids).not.toContain("p02");
    expect(ids.filter(Boolean)).toHaveLength(4);
  });
});

describe("byes", () => {
  it("an odd field gets exactly one bye, a random one in round 1", () => {
    const byes = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const ev = startSwiss(newEvent({ id: "e", entrants: players(5), cutSize: 0 }), byId, seededRng(seed));
      const bye = ev.rounds[0]!.matches.filter((m) => m.b === null);
      expect(bye).toHaveLength(1);
      byes.add(bye[0]!.a);
    }
    expect(byes.size).toBeGreaterThan(2);
  });

  it("later byes go to the lowest-ranked player without a bye", () => {
    const ev = swissEvent(
      ["a", "b", "c", "d", "e"],
      [round(match("a", "b", "A"), match("d", "e", "A"), match("c", null))],
    );
    const r2 = pairRound(ev, byId, seededRng(1)).round;
    const bye = r2.matches.find((m) => m.b === null)!;
    // Standings: a 3, c 3, d 3, b 0, e 0 -> e is lowest (name tiebreak) and has no bye.
    expect(standings(ev, byId).at(-1)!.id).toBe("e");
    expect(bye.a).toBe("e");
  });

  it("skips players who already had a bye", () => {
    // e had the round-1 bye and is still last -> bye goes to the next lowest, d.
    const ev = swissEvent(
      ["a", "b", "c", "d", "e"],
      [round(match("a", "b", "A"), match("c", "d", "A"), match("e", null))],
    );
    const st = standings(ev, byId).map((s) => s.id);
    const r2 = pairRound(ev, byId, seededRng(1)).round;
    const lowestWithout = st.filter((id) => id !== "e").at(-1);
    expect(r2.matches.find((m) => m.b === null)!.a).toBe(lowestWithout);
  });

  it("if everyone has had a bye, the lowest-ranked player gets it", () => {
    const ev = swissEvent(["a"], [round(match("a", null))]);
    expect(pairRound(ev, byId, seededRng(1)).round.matches).toEqual([match("a", null)]);
  });
});

describe("single-sided sides", () => {
  it("the player with fewer Corp-minus-Runner games takes Corp", () => {
    // a played Corp against d last round; their (forced) rematch gives d the Corp side.
    const ev = swissEvent(["a", "d"], [round(match("a", "d", "A", "a"))]);
    const m = pairRound(ev, byId, seededRng(1)).round.matches[0]!;
    const corp = m.corp === "a" ? m.a : m.b;
    expect(corp).toBe("d");
  });

  it("equal side balance is a coin flip", () => {
    const corps = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const m = pairRound(swissEvent(["a", "b"]), byId, seededRng(seed)).round.matches[0]!;
      corps.add(m.corp === "a" ? m.a : m.b!);
    }
    expect(corps).toEqual(new Set(["a", "b"]));
  });

  it("prefers opponents who do not owe the same side", () => {
    // After round 1, a and c both played Corp (bias +1); b and d both played Runner (bias -1).
    // a and c both won (3 pts) so score order is a, c, b, d. Strict pairing avoids a-c (both owe Runner).
    const ev = swissEvent(
      ["a", "b", "c", "d"],
      [round(match("a", "b", "A", "a"), match("c", "d", "A", "a"))],
    );
    expect(sideBias(ev)).toEqual({ a: 1, b: -1, c: 1, d: -1 });
    const res = pairRound(ev, byId, seededRng(1));
    expect(res.mode).toBe("strict");
    const keys = res.round.matches.map((m) => pairKey(m.a, m.b!));
    expect(keys).toEqual([pairKey("a", "d"), pairKey("c", "b")]);
  });

  it("over a full event, nobody is ever more than 2 games off balance (8 players, 200 seeds)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seededRng(seed);
      let ev = playRound(
        startSwiss(newEvent({ id: "e", entrants: players(8), cutSize: 0, swissRounds: 5 }), byId, rng),
        rng,
      );
      for (let r = 2; r <= 5; r++) ev = playRound(pairNextRound(ev, byId, rng), rng);
      for (const b of Object.values(sideBias(ev))) expect(Math.abs(b)).toBeLessThanOrEqual(2);
    }
  });
});

describe("double-sided sides", () => {
  it("game 1 Corp is a coin flip and ignores side history", () => {
    const corps = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const ev = swissEvent(["a", "b"], [], { format: "double" });
      const m = pairRound(ev, byId, seededRng(seed)).round.matches[0]!;
      corps.add(m.corp!);
    }
    expect(corps).toEqual(new Set(["a", "b"]));
    expect(
      sideBias(swissEvent(["a", "b"], [round(match("a", "b", "A", "a", "A"))], { format: "double" })),
    ).toEqual({ a: 0, b: 0 });
  });
});

describe("late add, drop and restart round", () => {
  it("a late player joins the next pairing with zero points", () => {
    const rng = seededRng(5);
    let ev = playRound(startSwiss(newEvent({ id: "e", entrants: players(4), cutSize: 0 }), byId, rng), rng);
    ev = addEntrant(ev, "late");
    expect(standings(ev, byId).find((s) => s.id === "late")!.points).toBe(0);
    ev = pairNextRound(ev, byId, rng);
    expect(ev.rounds[1]!.matches.flatMap((m) => [m.a, m.b])).toContain("late");
  });

  it("restart round re-pairs including late adds and excluding drops", () => {
    const rng = seededRng(9);
    let ev = playRound(startSwiss(newEvent({ id: "e", entrants: players(6), cutSize: 0 }), byId, rng), rng);
    ev = pairNextRound(ev, byId, rng);
    ev = setResult(ev, { phase: "swiss", round: 1, match: 0, game: 1, result: "A" }, byId, rng);
    ev = addEntrant(ev, "late");
    ev = dropEntrant(ev, "p01");
    ev = restartRound(ev, "swiss", byId, rng);
    expect(ev.rounds).toHaveLength(2);
    const ids = ev.rounds[1]!.matches.flatMap((m) => [m.a, m.b]);
    expect(ids).toContain("late");
    expect(ids).not.toContain("p01");
    expect(ev.rounds[1]!.matches.every((m) => m.b === null || m.g1 === null)).toBe(true);
  });

  it("restart round 1 reshuffles", () => {
    const rng = seededRng(2);
    const ev = startSwiss(newEvent({ id: "e", entrants: players(8), cutSize: 0 }), byId, rng);
    const again = restartRound(ev, "swiss", byId, rng);
    expect(again.rounds).toHaveLength(1);
    expect(again.rounds[0]).not.toEqual(ev.rounds[0]);
  });

  it("a dropped player can be re-added", () => {
    const ev = undropEntrant(dropEntrant(swissEvent(["a", "b"]), "a"), "a");
    expect(ev.dropped).toEqual([]);
  });
});
