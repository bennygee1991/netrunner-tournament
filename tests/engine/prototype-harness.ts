/**
 * Loads the tournament logic from reference/prototype.html so engine tests can compare against it.
 * The prototype's Math.random is replaced by an injected rng, and its players live in `S.players`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { EventState, GameResult, Match, Round } from "@/engine";

const html = readFileSync(fileURLToPath(new URL("../../reference/prototype.html", import.meta.url)), "utf8");

function between(start: string, end: string): string {
  const i = html.indexOf(start);
  const j = html.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error(`prototype markers not found: ${start}`);
  return html.slice(i, j);
}

const helpers = [/function shuffle\(a\)\{.*\}/, /function nm\(id\)\{.*\}/]
  .map((re) => {
    const m = html.match(re);
    if (!m) throw new Error(`helper not found: ${re}`);
    return m[0];
  })
  .join("\n");
const logic = between("/* ---------- tournament logic ---------- */", "/* ---------- views ---------- */");

export type ProtoMatch = {
  a: string;
  b: string | null;
  c?: "a" | "b";
  res: "a" | "b" | "d" | null;
  g1?: "a" | "b" | "d" | null;
  g2?: "a" | "b" | "d" | null;
};
export type ProtoEvent = {
  id: string;
  month: 1 | 2;
  format: "ss" | "ds";
  status: "signup" | "swiss" | "cut" | "done";
  entrants: string[];
  dropped?: string[];
  swissRounds: number;
  cutSize: number;
  rounds: { m: ProtoMatch[] }[];
  cut: { m: ProtoMatch[] }[];
};
type ProtoStanding = {
  id: string;
  pts: number;
  w: number;
  d: number;
  l: number;
  sos: number;
  esos: number;
  rank: number;
  byes: number;
};

export interface Prototype {
  S: { players: { id: string; name: string }[] };
  standings(ev: ProtoEvent): ProtoStanding[];
  pairRound(ev: ProtoEvent): void;
  startCut(ev: ProtoEvent): void;
  cutSide(ev: ProtoEvent, a: string, b: string): "a" | "b";
  eventResults(ev: ProtoEvent): Record<string, { pts: number; label: string; rank: number }>;
  board(evs: ProtoEvent[]): { id: string; tot: number; titles: number; rank: number; played: number }[];
  defRounds(ev: ProtoEvent, n: number): number;
  seedOrder(n: number): number[];
  roundDone(r: { m: ProtoMatch[] }, ds: boolean): boolean;
}

/** A fresh prototype instance whose randomness comes from `rng`. */
export function loadPrototype(rng: () => number): Prototype {
  const S = { players: [] as { id: string; name: string }[] };
  const fakeMath = Object.assign(Object.create(Math), { random: rng });
  const factory = new Function(
    "S",
    "Math",
    `"use strict";\n${helpers}\n${logic}\nreturn {standings,pairRound,startCut,cutSide,eventResults,board,defRounds,seedOrder,roundDone};`,
  );
  return { S, ...factory(S, fakeMath) };
}

const up = (r: "a" | "b" | "d" | null | undefined): GameResult | null =>
  r ? (r.toUpperCase() as GameResult) : null;

function convertMatch(x: ProtoMatch, phase: "swiss" | "cut", ds: boolean): Match {
  if (!x.b) return { a: x.a, b: null, corp: null, g1: "A", g2: null };
  if (phase === "swiss" && ds) return { a: x.a, b: x.b, corp: x.c ?? null, g1: up(x.g1), g2: up(x.g2) };
  return { a: x.a, b: x.b, corp: x.c ?? null, g1: up(x.res), g2: null };
}

/** Converts a prototype event to the engine's shape for comparison. */
export function toEngine(ev: ProtoEvent): EventState {
  const ds = ev.format === "ds";
  const rounds = (rs: { m: ProtoMatch[] }[], phase: "swiss" | "cut"): Round[] =>
    rs.map((r) => ({ matches: r.m.map((x) => convertMatch(x, phase, ds)) }));
  return {
    id: ev.id,
    month: ev.month,
    format: ds ? "double" : "single",
    status: ev.status,
    entrants: [...ev.entrants],
    dropped: [...(ev.dropped ?? [])],
    swissRounds: ev.swissRounds || null,
    cutSize: ev.cutSize,
    rounds: rounds(ev.rounds, "swiss"),
    cut: rounds(ev.cut, "cut"),
  };
}

/** Prototype `act()` operations, minus the DOM. */
export const protoOps = {
  startSwiss(p: Prototype, ev: ProtoEvent) {
    const n = ev.entrants.length;
    if (!ev.swissRounds) ev.swissRounds = p.defRounds(ev, n);
    let c = ev.cutSize;
    while (c > n) c /= 2;
    if (c < 4) c = 0;
    ev.cutSize = c;
    ev.rounds = [];
    ev.cut = [];
    ev.status = "swiss";
    p.pairRound(ev);
  },
  restartRound(p: Prototype, ev: ProtoEvent) {
    ev.rounds.pop();
    p.pairRound(ev);
  },
  undoSwiss(ev: ProtoEvent) {
    ev.rounds.pop();
    if (!ev.rounds.length) ev.status = "signup";
  },
  /** Restart a cut round after the first (the first-round restart differs on purpose, see DECISIONS). */
  restartLaterCut(p: Prototype, ev: ProtoEvent) {
    const ci = ev.cut.length - 1;
    const pr = ev.cut[ci - 1]!;
    const w = pr.m.map((x) => (x.res === "a" ? x.a : x.b!));
    ev.cut = ev.cut.slice(0, ci);
    const nx: ProtoMatch[] = [];
    for (let q = 0; q < w.length; q += 2)
      nx.push({ a: w[q]!, b: w[q + 1]!, c: p.cutSide(ev, w[q]!, w[q + 1]!), res: null });
    ev.cut.push({ m: nx });
    ev.status = "cut";
  },
  setResult(
    p: Prototype,
    ev: ProtoEvent,
    phase: "s" | "c",
    ri: number,
    mi: number,
    g: 0 | 1 | 2,
    v: "a" | "b" | "d" | null,
  ) {
    const m = (phase === "s" ? ev.rounds[ri]! : ev.cut[ri]!).m[mi]!;
    const fld = g === 1 ? "g1" : g === 2 ? "g2" : "res";
    m[fld] = v;
    if (phase === "c") {
      const r = ev.cut[ri]!;
      if (p.roundDone(r, false)) {
        if (r.m.length === 1) ev.status = "done";
        else if (ev.cut.length === ri + 1) {
          const w = r.m.map((x) => (x.res === "a" ? x.a : x.b!));
          const nx: ProtoMatch[] = [];
          for (let i = 0; i < w.length; i += 2)
            nx.push({ a: w[i]!, b: w[i + 1]!, c: p.cutSide(ev, w[i]!, w[i + 1]!), res: null });
          ev.cut.push({ m: nx });
        }
      }
    }
  },
};
