import { describe, expect, it } from "vitest";
import { byePoints, defaultSwissRounds } from "./rules";
import { corpForGame, standings } from "./standings";
import { byId, match, round, swissEvent } from "./test-helpers";

describe("scoring", () => {
  it("scores win 3, tie 1, loss 0 per game", () => {
    const ev = swissEvent(["a", "b", "c", "d"], [round(match("a", "b", "A"), match("c", "d", "D"))]);
    const pts = Object.fromEntries(standings(ev, byId).map((s) => [s.id, s.points]));
    expect(pts).toEqual({ a: 3, b: 0, c: 1, d: 1 });
  });

  it("double-sided rounds score both games", () => {
    const ev = swissEvent(["a", "b"], [round(match("a", "b", "A", "a", "D"))], { format: "double" });
    const s = Object.fromEntries(
      standings(ev, byId).map((x) => [x.id, [x.points, x.wins, x.draws, x.losses]]),
    );
    expect(s).toEqual({ a: [4, 1, 1, 0], b: [1, 0, 1, 1] });
  });

  it("a bye is worth winning every game in the round", () => {
    expect(byePoints("single")).toBe(3);
    expect(byePoints("double")).toBe(6);
    const single = swissEvent(["a", "b", "c"], [round(match("a", "b", "B"), match("c", null))]);
    expect(standings(single, byId).find((s) => s.id === "c")).toMatchObject({
      points: 3,
      wins: 1,
      byes: 1,
      opponents: [],
    });
    const double = swissEvent(["a", "b", "c"], [round(match("a", "b", "B", "a", "B"), match("c", null))], {
      format: "double",
    });
    expect(standings(double, byId).find((s) => s.id === "c")).toMatchObject({ points: 6, wins: 2 });
  });

  it("counts Corp and Runner games in single-sided Swiss", () => {
    const ev = swissEvent(["a", "b"], [round(match("a", "b", "A", "b")), round(match("a", "b", "A", "b"))]);
    expect(standings(ev, byId).find((s) => s.id === "b")).toMatchObject({ corpGames: 2, runnerGames: 0 });
  });
});

describe("tiebreaks", () => {
  // Round 1: a beats b, c beats d. Round 2: a beats c, b beats d. R = 2.
  // Points: a 6, b 3, c 3, d 0.
  const ev = swissEvent(
    ["a", "b", "c", "d"],
    [round(match("a", "b", "A"), match("c", "d", "A")), round(match("a", "c", "A"), match("b", "d", "A"))],
  );
  const st = Object.fromEntries(standings(ev, byId).map((s) => [s.id, s]));

  it("SoS = sum of (opponent points / rounds) / rounds", () => {
    expect(st.a!.sos).toBeCloseTo((3 / 2 + 3 / 2) / 2); // opponents b, c
    expect(st.b!.sos).toBeCloseTo((6 / 2 + 0 / 2) / 2); // opponents a, d
    expect(st.c!.sos).toBeCloseTo((0 / 2 + 6 / 2) / 2); // opponents d, a
    expect(st.d!.sos).toBeCloseTo((3 / 2 + 3 / 2) / 2); // opponents c, b
  });

  it("extended SoS = mean of opponents' SoS", () => {
    expect(st.a!.esos).toBeCloseTo((st.b!.sos + st.c!.sos) / 2);
    expect(st.d!.esos).toBeCloseTo((st.c!.sos + st.b!.sos) / 2);
  });

  it("orders by points, then SoS, then extended SoS, then name", () => {
    // b and c: 3 points, equal SoS (1.5) and equal extended SoS -> name decides.
    expect(standings(ev, byId).map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
    const renamed = standings(ev, (id) => ({ b: "Zed", c: "Amy" })[id] ?? id).map((s) => s.id);
    expect(renamed).toEqual(["a", "c", "b", "d"]);
  });

  it("a bye round counts in R but adds no opponent", () => {
    const withBye = swissEvent(["a", "b", "c"], [round(match("a", "b", "A"), match("c", null))]);
    const s = Object.fromEntries(standings(withBye, byId).map((x) => [x.id, x]));
    expect(s.c!.sos).toBe(0);
    expect(s.c!.esos).toBe(0);
    expect(s.a!.sos).toBe(0); // b has 0 points
    expect(s.b!.sos).toBe(3); // a: 3 / 1 / 1
  });

  it("dropped players stay in the standings", () => {
    const ev2 = swissEvent(["a", "b"], [round(match("a", "b", "A"))], { dropped: ["a"] });
    expect(standings(ev2, byId).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("default Swiss rounds", () => {
  it.each([
    ["single", 2, 1],
    ["single", 4, 3],
    ["single", 8, 5],
    ["single", 15, 5],
    ["single", 16, 6],
    ["single", 40, 6],
    ["double", 3, 2],
    ["double", 8, 3],
    ["double", 11, 3],
    ["double", 12, 4],
  ] as const)("%s with %i players -> %i rounds", (format, n, rounds) => {
    expect(defaultSwissRounds(format, n)).toBe(rounds);
  });
});

describe("double-sided sides", () => {
  it("sides swap in game 2", () => {
    const m = match("a", "b", null, "b");
    expect(corpForGame(m, 1)).toBe("b");
    expect(corpForGame(m, 2)).toBe("a");
  });
});
