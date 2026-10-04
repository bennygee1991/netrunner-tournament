import { type AvatarGlyph, type AvatarPalette, resolveAvatar } from "@/lib/avatars";

const PALETTES: Record<AvatarPalette, { fg: string; glow: string }> = {
  cyan: { fg: "#22e3ff", glow: "#0b5c6b" },
  magenta: { fg: "#ff2bd6", glow: "#6b0f5a" },
  amber: { fg: "#ffc94a", glow: "#6b5210" },
};

/** Line-art glyphs on a 64×64 grid, drawn with the palette colour. */
function Glyph({ glyph }: { glyph: AvatarGlyph }) {
  switch (glyph) {
    case "chip":
      return (
        <>
          <rect x="20" y="20" width="24" height="24" rx="3" />
          <rect x="27" y="27" width="10" height="10" />
          <path d="M26 20v-8M32 20v-8M38 20v-8M26 44v8M32 44v8M38 44v8M20 26h-8M20 32h-8M20 38h-8M44 26h8M44 32h8M44 38h8" />
        </>
      );
    case "eye":
      return (
        <>
          <path d="M10 32c6-10 14-15 22-15s16 5 22 15c-6 10-14 15-22 15S16 42 10 32z" />
          <circle cx="32" cy="32" r="7" />
          <path d="M32 25v-4M32 43v-4" />
        </>
      );
    case "bolt":
      return <path d="M36 10L18 36h12l-4 18 20-28H34l2-16z" />;
    case "key":
      return (
        <>
          <circle cx="22" cy="32" r="9" />
          <path d="M31 32h23M46 32v8M52 32v6" />
        </>
      );
    case "hex":
      return (
        <>
          <path d="M32 10l19 11v22L32 54 13 43V21z" />
          <path d="M32 22l9 5v10l-9 5-9-5V27z" />
        </>
      );
    case "signal":
      return (
        <>
          <circle cx="32" cy="44" r="3" />
          <path d="M23 37a13 13 0 0118 0M17 31a21 21 0 0130 0M11 25a29 29 0 0142 0" />
        </>
      );
    case "visor":
      return (
        <>
          <path d="M16 40V28a16 16 0 0132 0v12" />
          <path d="M14 30h36v8H14z" />
          <path d="M24 48h16" />
        </>
      );
    case "ghost":
      return (
        <>
          <path d="M18 52V30a14 14 0 0128 0v22l-5-4-4 4-5-4-5 4-4-4z" />
          <path d="M26 30v4M38 30v4" />
        </>
      );
  }
}

/**
 * A player's avatar. Decorative by default (the name is always shown next to it); pass `label`
 * when it stands alone.
 */
export function Avatar({
  avatar,
  seed,
  size = 40,
  label,
  className,
}: {
  avatar: string | null | undefined;
  seed: string;
  size?: number;
  label?: string;
  className?: string;
}) {
  const { glyph, palette } = resolveAvatar(avatar, seed);
  const c = PALETTES[palette];
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <rect width="64" height="64" rx="12" fill="#0b0f19" />
      <rect x="1.5" y="1.5" width="61" height="61" rx="11" fill="none" stroke={c.glow} strokeWidth="3" />
      <g fill="none" stroke={c.fg} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <Glyph glyph={glyph} />
      </g>
    </svg>
  );
}
