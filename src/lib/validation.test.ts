import { describe, expect, it } from "vitest";
import { passwordProblem, runnerNameKey, runnerNameSchema } from "./validation";

describe("runnerNameSchema", () => {
  it.each(["Abe", "Noise_Fan-99", "Gabriel Santiago", "x".repeat(24)])("accepts %s", (name) => {
    expect(runnerNameSchema.safeParse(name).success).toBe(true);
  });

  it.each([
    ["ab", "too short"],
    ["x".repeat(25), "too long"],
    ["bad!name", "symbol"],
    ["two  spaces", "double space"],
    ["émile", "non-ASCII letter"],
  ])("rejects %s (%s)", (name) => {
    expect(runnerNameSchema.safeParse(name).success).toBe(false);
  });

  it("trims surrounding spaces and keeps casing", () => {
    expect(runnerNameSchema.parse("  Kate Mac ")).toBe("Kate Mac");
  });

  it("builds a case-insensitive key", () => {
    expect(runnerNameKey(" ReiNa Roja ")).toBe("reina roja");
  });
});

describe("passwordProblem", () => {
  it("accepts a reasonable password", () => {
    expect(passwordProblem("correct horse battery")).toBeNull();
  });

  it("enforces the 10 character minimum", () => {
    expect(passwordProblem("short1!")).toMatch(/at least 10/);
  });

  it("rejects common passwords case-insensitively", () => {
    expect(passwordProblem("Password123")).toMatch(/too common/);
  });

  it("rejects low-variety passwords", () => {
    expect(passwordProblem("abababababab")).toMatch(/variety/);
  });

  it("rejects passwords containing the runner name", () => {
    expect(passwordProblem("my-Whizzard-pass", "whizzard")).toMatch(/runner name/);
  });
});
