import { describe, expect, it } from "vitest";
import { AVATAR_KEYS, avatarLabel, defaultAvatarKey, isAvatarKey, resolveAvatar } from "./avatars";

describe("avatars", () => {
  it("has 24 unique presets", () => {
    expect(AVATAR_KEYS).toHaveLength(24);
    expect(new Set(AVATAR_KEYS).size).toBe(24);
  });

  it("validates keys strictly", () => {
    expect(isAvatarKey("eye-cyan")).toBe(true);
    for (const bad of ["eye", "eye-red", "<script>", "", null, 3]) expect(isAvatarKey(bad)).toBe(false);
  });

  it("gives every player a stable default and spreads them out", () => {
    expect(defaultAvatarKey("user-1")).toBe(defaultAvatarKey("user-1"));
    const used = new Set(Array.from({ length: 200 }, (_, i) => defaultAvatarKey(`cm${i}x`)));
    expect(used.size).toBeGreaterThan(15);
  });

  it("falls back to the default for unknown stored values", () => {
    expect(resolveAvatar("nope", "abc")).toEqual(resolveAvatar(null, "abc"));
    expect(resolveAvatar("bolt-amber", "abc")).toEqual({ glyph: "bolt", palette: "amber" });
    expect(avatarLabel("hex-magenta")).toBe("Hex core, magenta");
  });
});
