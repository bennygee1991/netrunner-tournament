import { FINALE } from "@/engine";
import { Card, CardTitle, cx } from "@/components/ui";
import type { SeedingRow } from "@/lib/tournament/finale";

export function FinaleBanner() {
  return (
    <p className="mb-4 rounded border border-warn px-3 py-2 text-sm">
      <span className="font-bold text-warn">Season finale</span> · ×{FINALE.pointsMultiplier} league points ·
      the top {FINALE.cutSize} cut is seeded from the Season leaderboard
    </p>
  );
}

/** Finale cut qualification: season standings, top seeds highlighted. */
export function SeasonSeeding({ rows, fixed }: { rows: SeedingRow[]; fixed: boolean }) {
  return (
    <Card tone="warn">
      <CardTitle>Cut qualification</CardTitle>
      <p className="mb-3 text-sm text-muted">
        {fixed
          ? "Seeds were fixed from the Season leaderboard when the cut started."
          : "Projected from the Season leaderboard; season ties are broken by this event's Swiss standings. Fixed when the cut starts."}
      </p>
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Cut qualification (scrolls sideways)"
      >
        <table className="w-full border-collapse font-mono text-sm">
          <caption className="sr-only">Cut qualification by season standings</caption>
          <thead>
            <tr className="border-b border-border text-[11px] tracking-widest text-muted uppercase">
              <th scope="col" className="p-2 text-left">
                Seed
              </th>
              <th scope="col" className="p-2 text-left">
                Player
              </th>
              <th scope="col" className="p-2 text-right">
                Season pts
              </th>
              <th scope="col" className="p-2 text-right">
                Cut
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cx("border-b border-border", r.inCut && "bg-cyan/10")}>
                <td className={cx("p-2", r.inCut ? "text-cyan" : "text-muted")}>
                  {r.dropped ? "–" : r.seed}
                </td>
                <td className="p-2 font-sans text-base font-semibold">
                  {r.name}
                  {r.dropped && <span className="ml-1 text-xs font-normal text-muted">(dropped)</span>}
                </td>
                <td className="p-2 text-right text-cyan">{r.seasonTotal}</td>
                <td className="p-2 text-right">{r.inCut ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
