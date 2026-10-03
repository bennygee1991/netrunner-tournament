import { PlayerLink } from "@/components/player-link";
import type { Standing } from "@/engine";
import { cx } from "@/components/ui";

export function StandingsTable({
  standings,
  nameOf,
  cutSize,
  double,
  dropped,
  profileOf = () => null,
}: {
  standings: Standing[];
  nameOf: (id: string) => string;
  /** Runner name to link to, for account holders. */
  profileOf?: (id: string) => string | null;
  cutSize: number;
  double: boolean;
  dropped: Set<string>;
}) {
  if (!standings.length) return <p className="text-muted">Standings appear once Swiss starts.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-sm">
        <caption className="sr-only">Swiss standings</caption>
        <thead>
          <tr className="border-b border-border text-[11px] tracking-widest text-muted uppercase">
            <th scope="col" className="p-2 text-left">
              #
            </th>
            <th scope="col" className="p-2 text-left">
              Player
            </th>
            <th scope="col" className="p-2 text-right">
              Pts
            </th>
            <th scope="col" className="p-2 text-right">
              W-D-L
            </th>
            <th scope="col" className="p-2 text-right">
              SoS
            </th>
            <th scope="col" className="p-2 text-right">
              xSoS
            </th>
            {!double && (
              <th scope="col" className="p-2 text-right">
                C/R
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => {
            const inCut = cutSize > 0 && s.rank <= cutSize;
            return (
              <tr key={s.id} className={cx("border-b border-border", inCut && "bg-cyan/10")}>
                <td className={cx("p-2", inCut ? "text-cyan" : "text-muted")}>{s.rank}</td>
                <td className="p-2 font-sans text-base font-semibold">
                  <PlayerLink name={nameOf(s.id)} profile={profileOf(s.id)} />
                  {dropped.has(s.id) && (
                    <span className="ml-1 text-xs font-normal text-muted">(dropped)</span>
                  )}
                </td>
                <td className="p-2 text-right font-bold text-cyan">{s.points}</td>
                <td className="p-2 text-right">
                  {s.wins}-{s.draws}-{s.losses}
                </td>
                <td className="p-2 text-right">{s.sos.toFixed(2)}</td>
                <td className="p-2 text-right">{s.esos.toFixed(2)}</td>
                {!double && (
                  <td className="p-2 text-right">
                    {s.corpGames}/{s.runnerGames}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        Each game: win 3 · tie 1 · loss 0. Tiebreaks: strength of schedule (SoS), then extended SoS.
        {cutSize > 0 && ` Highlighted rows are inside the top ${cutSize} cut line.`}
      </p>
    </div>
  );
}
