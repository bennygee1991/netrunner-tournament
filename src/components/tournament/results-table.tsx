import { PlayerLink } from "@/components/player-link";
import type { EventResult } from "@/engine";

export function ResultsTable({
  results,
  nameOf,
  profileOf = () => null,
  noPoints = false,
}: {
  results: Map<string, EventResult>;
  nameOf: (id: string) => string;
  /** Runner name to link to, for account holders. */
  profileOf?: (id: string) => string | null;
  /** One-off events: placings only, no league points. */
  noPoints?: boolean;
}) {
  const caption = noPoints ? "Final placings" : "League points earned";
  const rows = [...results].sort((a, b) => b[1].points - a[1].points || a[1].rank - b[1].rank);
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${caption} (scrolls sideways)`}>
      <table className="w-full border-collapse font-mono text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-[11px] tracking-widest text-muted uppercase">
            <th scope="col" className="p-2 text-left">
              Player
            </th>
            <th scope="col" className="p-2 text-left">
              Result
            </th>
            {!noPoints && (
              <th scope="col" className="p-2 text-right">
                League pts
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, r]) => (
            <tr key={id} className="border-b border-border">
              <td className="p-2 font-sans text-base font-semibold">
                <PlayerLink name={nameOf(id)} profile={profileOf(id)} />
              </td>
              <td className={r.label === "Champion" ? "p-2 text-warn" : "p-2"}>{r.label}</td>
              {!noPoints && <td className="p-2 text-right font-bold text-cyan">+{r.points}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
