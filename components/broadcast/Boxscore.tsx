import { TeamBadge } from "@/components/TeamBadge";
import { requireTeam } from "@/lib/selectors";
import type { HomeData } from "@/lib/home";
import type { Match } from "@/lib/types";

/**
 * The half-by-half table and points donut that sit in the card lapping over a
 * matchup hero, mirroring the reference video's boxscore panel.
 */
export function Boxscore({ match, standings }: { match: Match; standings: HomeData["standings"] }) {
  const halves = (["home", "away"] as const).map((side) => {
    const slug = match[side].teamSlug;
    const goals = match.events.filter(
      (event) => event.teamSlug === slug && (event.type === "goal" || event.type === "penalty"),
    );
    return {
      team: requireTeam(slug),
      first: goals.filter((event) => event.minute <= 45).length,
      second: goals.filter((event) => event.minute > 45).length,
      total: match[side].score,
    };
  });

  // Points share between the two sides, the honest stand-in for the
  // possession donut in the reference, given the data we actually hold. It
  // only means anything when both sides are in the table, so a non-conference
  // opponent drops the donut rather than showing a fictional 0%.
  const rows = halves.map((half) => standings.find((line) => line.team.slug === half.team.slug));
  const comparable = rows.every(Boolean);
  const points = rows.map((line) => line?.row.conference.pts ?? 0);
  const total = points[0] + points[1] || 1;
  const homeShare = Math.round((points[0] / total) * 100);

  return (
    <div className={`grid gap-5 ${comparable ? "md:grid-cols-[1fr_auto] md:gap-8" : ""}`}>
      <div>
        <h3 className="bc-label mb-3 text-[0.7rem] text-ink-faint">Boxscore</h3>
        <table className="w-full text-[0.85rem]">
          <thead>
            <tr className="bc-label text-[0.65rem] text-ink-faint">
              <th scope="col" className="pb-1.5 text-left">Team</th>
              <th scope="col" className="px-3 pb-1.5 text-center">1H</th>
              <th scope="col" className="px-3 pb-1.5 text-center">2H</th>
              <th scope="col" className="pb-1.5 pl-3 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {halves.map((half) => (
              <tr key={half.team.slug} className="border-t border-line">
                <td className="bc-row">
                  <span className="flex items-center gap-2">
                    <TeamBadge team={half.team} size="xs" />
                    <span className="truncate font-semibold text-ink">{half.team.name}</span>
                  </span>
                </td>
                <td className="bc-row px-3 text-center text-ink-muted tabular-nums">
                  {half.total === null ? "–" : half.first}
                </td>
                <td className="bc-row px-3 text-center text-ink-muted tabular-nums">
                  {half.total === null ? "–" : half.second}
                </td>
                <td className="bc-row pl-3 text-center text-[0.95rem] font-black text-ink tabular-nums">
                  {half.total ?? "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comparable ? (
      <div className="flex items-center gap-4 border-t border-line pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-8">
        <div className="relative size-20 shrink-0">
          {/* Only the ring is lifted in dark mode; the punched-out centre has
              to stay exactly the surface colour. */}
          <span
            className="team-color absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(${halves[0].team.primary} 0% ${homeShare}%, ${halves[1].team.primary} ${homeShare}% 100%)`,
            }}
          />
          <span className="absolute inset-[9px] rounded-full bg-surface" />
        </div>
        <div className="text-[0.78rem]">
          <p className="bc-label mb-1 text-[0.65rem] text-ink-faint">CCIW points share</p>
          {halves.map((half, index) => (
            <p key={half.team.slug} className="flex items-center gap-1.5 py-0.5">
              <span className="team-color size-2 rounded-full" style={{ background: half.team.primary }} />
              <span className="font-semibold text-ink">{half.team.name}</span>
              <span className="ml-auto pl-3 font-black text-ink tabular-nums">
                {index === 0 ? homeShare : 100 - homeShare}%
              </span>
            </p>
          ))}
        </div>
      </div>
      ) : null}
    </div>
  );
}
