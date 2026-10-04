/**
 * Preset player avatars: original cyberpunk glyphs (no official Netrunner artwork or faction
 * logos) in a few colour schemes. Stored on the user as a key like "eye-cyan".
 */
export const AVATAR_GLYPHS = ["chip", "eye", "bolt", "key", "hex", "signal", "visor", "ghost"] as const;
export const AVATAR_PALETTES = ["cyan", "magenta", "amber"] as const;

export type AvatarGlyph = (typeof AVATAR_GLYPHS)[number];
export type AvatarPalette = (typeof AVATAR_PALETTES)[number];

export const GLYPH_LABELS: Record<AvatarGlyph, string> = {
  chip: "Chip",
  eye: "Eye",
  bolt: "Bolt",
  key: "Key",
  hex: "Hex core",
  signal: "Signal",
  visor: "Visor",
  ghost: "Ghost",
};

export const AVATAR_KEYS: readonly string[] = AVATAR_GLYPHS.flatMap((g) =>
  AVATAR_PALETTES.map((p) => `${g}-${p}`),
);

export function isAvatarKey(v: unknown): v is string {
  return typeof v === "string" && AVATAR_KEYS.includes(v);
}

/** Stable default for players who have not picked one (FNV-1a hash of their id). */
export function defaultAvatarKey(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return AVATAR_KEYS[h % AVATAR_KEYS.length]!;
}

export function resolveAvatar(
  avatar: string | null | undefined,
  seed: string,
): { glyph: AvatarGlyph; palette: AvatarPalette } {
  const key = isAvatarKey(avatar) ? avatar : defaultAvatarKey(seed);
  const [glyph, palette] = key.split("-") as [AvatarGlyph, AvatarPalette];
  return { glyph, palette };
}

export function avatarLabel(key: string): string {
  const [glyph, palette] = key.split("-") as [AvatarGlyph, AvatarPalette];
  return `${GLYPH_LABELS[glyph]}, ${palette}`;
}
