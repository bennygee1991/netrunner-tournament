import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";
import { hashToken, newSessionToken, newTempPassword } from "./tokens";

describe("tokens", () => {
  it("session tokens are long, random and url-safe", () => {
    const a = newSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newSessionToken()).not.toBe(a);
  });

  it("hashToken is a stable sha256 hex digest that differs from the token", () => {
    const t = newSessionToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
  });

  it("temporary passwords meet the password rules and avoid look-alikes", () => {
    for (let i = 0; i < 50; i++) {
      const p = newTempPassword();
      expect(p).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
      expect(p).not.toMatch(/[01ilo]/);
    }
  });
});

describe("safeNext", () => {
  it.each([
    ["/account", "/account"],
    ["/events/abc?x=1", "/events/abc?x=1"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    [undefined, "/"],
    [["/a"], "/"],
  ])("%s -> %s", (input, out) => {
    expect(safeNext(input)).toBe(out);
  });
});
