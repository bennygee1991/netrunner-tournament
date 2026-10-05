import { describe, expect, it } from "vitest";
import { applyClockOp, formatClock, readClocks, remainingMs } from "./clock";

const t = (min: number) => new Date(Date.UTC(2026, 0, 1, 18, 0) + min * 60_000);

describe("round clock", () => {
  it("counts down from the limit and goes negative over time", () => {
    const c = applyClockOp(null, "start", t(0))!;
    expect(remainingMs(c, 45, t(0).getTime())).toBe(45 * 60_000);
    expect(remainingMs(c, 45, t(44.5).getTime())).toBe(30_000);
    expect(formatClock(remainingMs(c, 45, t(47).getTime())!)).toBe("-2:00");
    expect(remainingMs(null, 45, t(1).getTime())).toBeNull();
  });

  it("pause freezes it, resume continues where it stopped, +1 adds a minute", () => {
    let c = applyClockOp(null, "start", t(0))!;
    c = applyClockOp(c, "pause", t(10))!;
    expect(remainingMs(c, 65, t(30).getTime())).toBe(55 * 60_000);
    c = applyClockOp(c, "resume", t(30))!;
    expect(remainingMs(c, 65, t(35).getTime())).toBe(50 * 60_000);
    c = applyClockOp(c, "add", t(35))!;
    expect(formatClock(remainingMs(c, 65, t(35).getTime())!)).toBe("51:00");
  });

  it("ignores actions that do not apply, and reset stops the clock", () => {
    expect(applyClockOp(null, "pause", t(0))).toBeUndefined();
    expect(applyClockOp(null, "add", t(0))).toBeUndefined();
    const c = applyClockOp(null, "start", t(0))!;
    expect(applyClockOp(c, "start", t(1))).toBeUndefined();
    expect(applyClockOp(c, "resume", t(1))).toBeUndefined();
    expect(applyClockOp(c, "reset", t(1))).toBeNull();
  });

  it("stored clocks belong to one round only", () => {
    const stored = { round: "swiss:0", main: applyClockOp(null, "start", t(0)), deciders: {} };
    expect(readClocks(stored, "swiss:0").main).not.toBeNull();
    expect(readClocks(stored, "swiss:1")).toEqual({ round: "swiss:1", main: null, deciders: {} });
    expect(readClocks({ junk: true }, "cut:0").main).toBeNull();
  });
});
