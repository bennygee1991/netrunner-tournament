import { FINALE } from "@/engine";

/** Shown on the season finale's pages. */
export function FinaleBanner() {
  return (
    <p className="mb-4 rounded border border-warn px-3 py-2 text-sm">
      <span className="font-bold text-warn">Season finale</span> · ×{FINALE.pointsMultiplier} league points ·
      Swiss, then a top {FINALE.cutSize} cut where the higher seed picks sides, players swap for game 2, and a
      coin flip sets sides for a deciding game 3.
    </p>
  );
}
