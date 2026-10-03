/**
 * Differential test: plays random events through the prototype and the engine with identical
 * random sequences and asserts identical pairings, sides, standings, event points and boards.
 */
import { describe, expect, it } from "vitest";
import {
  type EventState,
  type GameResult,
  type NameOf,
  dropEntrant,
  addEntrant,
  eventResults,
  finishEvent,
  leaderboard,
  newEvent,
  pairNextRound,
  restartRound,
  seededRng,
  setResult,
  standings,
  startCut,
  startSwiss,
  undoRound,
  undropEntrant,
} from "@/engine";
import { type ProtoEvent, loadPrototype, protoOps, toEngine } from "./prototype-harness";

const NAMES = [
  "Kate",
  "Gabe",
  "Noise",
  "Whiz",
  "Andy",
  "Ji",
  "Reina",
  "Leela",
  "Hayley",
  "Rielle",
  "Omar",
  "Sunny",
  "Edward",
  "Ayla",
  "Nasir",
  "Iain",
  "Hoshiko",
  "Arissana",
  "Esa",
  "Ken",
  "Lat",
  "MaxX",
  "Steve",
  "Quetzal",
];

function simulate(seed: number, eventCount = 1) {
  const engineRng = seededRng(seed);
  const proto = loadPrototype(seededRng(seed));
  const choice = seededRng(seed ^ 0x9e3779b9);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(choice() * xs.length)]!;
  const chance = (p: number) => choice() < p;

  const names = new Map<string, string>();
  const nameOf: NameOf = (id) => names.get(id) ?? "?";
  const addPlayer = () => {
    const id = `p${names.size + 1}`;
    names.set(id, `${pick(NAMES)} ${names.size + 1}`);
    proto.S.players.push({ id, name: names.get(id)! });
    return id;
  };

  const protoEvents: ProtoEvent[] = [];
  const engineEvents: EventState[] = [];

  for (let e = 0; e < eventCount; e++) {
    const n = 2 + Math.floor(choice() * 19);
    const format = chance(0.4) ? "double" : "single";
    const cutSize = pick([0, 4, 8]);
    const ids = Array.from({ length: n }, addPlayer);
    const month = (e < 2 ? 1 : 2) as 1 | 2;
    const pev: ProtoEvent = {
      id: `e${e}`,
      month,
      format: format === "double" ? "ds" : "ss",
      status: "signup",
      entrants: [...ids],
      dropped: [],
      swissRounds: 0,
      cutSize,
      rounds: [],
      cut: [],
    };
    let eev = newEvent({ id: `e${e}`, month, format, cutSize, entrants: [...ids] });
    const ds = format === "double";

    const check = (step: string) => {
      const expected = toEngine(pev);
      expect(eev, `${step} (seed ${seed})`).toEqual(expected);
      const ps = proto.standings(pev);
      const es = standings(eev, nameOf);
      expect(
        es.map((s) => [s.id, s.points, s.sos, s.esos, s.rank]),
        step,
      ).toEqual(ps.map((s) => [s.id, s.pts, s.sos, s.esos, s.rank]));
    };

    protoOps.startSwiss(proto, pev);
    eev = startSwiss(eev, nameOf, engineRng);
    check("start swiss");

    const randomResult = (allowDraw: boolean): GameResult => {
      const r = choice();
      if (allowDraw && r < 0.12) return "D";
      return r < 0.56 ? "A" : "B";
    };
    const lower = (g: GameResult) => g.toLowerCase() as "a" | "b" | "d";

    let guard = 0;
    while (pev.status !== "done" && guard++ < 100) {
      if (pev.status === "swiss") {
        // Mid-round admin actions.
        if (chance(0.08)) {
          const id = addPlayer();
          pev.entrants.push(id);
          eev = addEntrant(eev, id);
          check("late add");
        }
        if (cutSize === 0 && chance(0.08)) {
          const id = pick(eev.entrants);
          if (!pev.dropped!.includes(id)) pev.dropped!.push(id);
          eev = dropEntrant(eev, id);
          check("drop");
          if (chance(0.3)) {
            pev.dropped = pev.dropped!.filter((x) => x !== id);
            eev = undropEntrant(eev, id);
            check("undrop");
          }
        }
        if (chance(0.1)) {
          protoOps.restartRound(proto, pev);
          eev = restartRound(eev, "swiss", nameOf, engineRng);
          check("restart swiss round");
        }
        const ri = pev.rounds.length - 1;
        pev.rounds[ri]!.m.forEach((x, mi) => {
          if (!x.b) return;
          for (const g of ds ? ([1, 2] as const) : ([0] as const)) {
            const v = randomResult(true);
            protoOps.setResult(proto, pev, "s", ri, mi, g, lower(v));
            eev = setResult(
              eev,
              { phase: "swiss", round: ri, match: mi, game: g === 2 ? 2 : 1, result: v },
              nameOf,
              engineRng,
            );
          }
        });
        check("results");
        // Repair an earlier round now and then.
        if (ri > 0 && chance(0.15)) {
          const r0 = Math.floor(choice() * ri);
          const mi = pev.rounds[r0]!.m.findIndex((x) => x.b);
          if (mi >= 0) {
            const v = randomResult(true);
            protoOps.setResult(proto, pev, "s", r0, mi, ds ? 1 : 0, lower(v));
            eev = setResult(
              eev,
              { phase: "swiss", round: r0, match: mi, game: 1, result: v },
              nameOf,
              engineRng,
            );
            check("repair");
          }
        }
        if (pev.rounds.length > 1 && chance(0.05)) {
          protoOps.undoSwiss(pev);
          eev = undoRound(eev, "swiss");
          check("undo swiss");
          continue;
        }
        if (pev.rounds.length < pev.swissRounds) {
          proto.pairRound(pev);
          eev = pairNextRound(eev, nameOf, engineRng);
          check("pair next");
        } else if (pev.cutSize > 0) {
          proto.startCut(pev);
          eev = startCut(eev, nameOf, engineRng);
          check("start cut");
        } else {
          pev.status = "done";
          eev = finishEvent(eev);
          check("finish");
        }
      } else if (pev.status === "cut") {
        const ri = pev.cut.length - 1;
        if (ri > 0 && chance(0.15)) {
          protoOps.restartLaterCut(proto, pev);
          eev = restartRound(eev, "cut", nameOf, engineRng);
          check("restart cut round");
        }
        const count = pev.cut[ri]!.m.length;
        for (let mi = 0; mi < count; mi++) {
          const v = chance(0.5) ? "A" : "B";
          protoOps.setResult(proto, pev, "c", ri, mi, 0, lower(v));
          eev = setResult(eev, { phase: "cut", round: ri, match: mi, game: 1, result: v }, nameOf, engineRng);
        }
        check("cut results");
      }
    }
    expect(pev.status).toBe("done");

    const pr = proto.eventResults(pev);
    const er = eventResults(eev, nameOf);
    expect(Object.fromEntries([...er].map(([id, r]) => [id, [r.points, r.label, r.rank]]))).toEqual(
      Object.fromEntries(Object.entries(pr).map(([id, r]) => [id, [r.pts, r.label, r.rank]])),
    );
    protoEvents.push(pev);
    engineEvents.push(eev);
  }

  const pb = proto.board(protoEvents);
  const eb = leaderboard(engineEvents, nameOf);
  expect(eb.map((r) => [r.id, r.total, r.titles, r.rank, r.played])).toEqual(
    pb.map((r) => [r.id, r.tot, r.titles, r.rank, r.played]),
  );
}

describe("engine matches the prototype", () => {
  it("single events across 400 random seeds", () => {
    for (let seed = 1; seed <= 400; seed++) simulate(seed);
  });

  it("four-event seasons with leaderboards across 60 random seeds", () => {
    for (let seed = 1000; seed < 1060; seed++) simulate(seed, 4);
  });

  it("prototype helpers agree on defaults and seeding", () => {
    const proto = loadPrototype(seededRng(1));
    expect(proto.seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(proto.seedOrder(4)).toEqual([1, 4, 2, 3]);
  });
});
