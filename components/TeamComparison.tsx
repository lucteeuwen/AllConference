import { FormDots } from "@/components/FormDots";
import { MatchRow } from "@/components/broadcast/MatchRow";
import { TeamBadge } from "@/components/TeamBadge";
import type { Comparison, StatRow } from "@/lib/comparison";
import type { Team } from "@/lib/types";

/** Which side a row favours, or null when it can't be compared or is level. */
function favoured(row: StatRow): "home" | "away" | null {
  if (row.homeValue === undefined || row.awayValue === undefined || !row.better) return null;
  if (row.homeValue === row.awayValue) return null;
  const homeHigher = row.homeValue > row.awayValue;
  return (row.better === "higher") === homeHigher ? "home" : "away";
}

/**
 * Two bars growing outward from the middle; the better side is in the accent
 * colour and always has the longer bar, so for "lower is better" figures the
 * shares are swapped (fewer goals conceded reads as the stronger bar).
 */
function Bars({ row }: { row: StatRow }) {
  if (row.homeValue === undefined || row.awayValue === undefined) return null;
  const total = Math.abs(row.homeValue) + Math.abs(row.awayValue);
  const share = (value: number) => (total > 0 ? (Math.abs(value) / total) * 100 : 0);
  const homeShare = share(row.better === "lower" ? row.awayValue : row.homeValue);
  const awayShare = share(row.better === "lower" ? row.homeValue : row.awayValue);
  const winner = favoured(row);
  const tone = (side: "home" | "away") =>
    winner === side ? "bg-accent" : winner === null ? "bg-ink-faint/50" : "bg-ink-faint/30";

  return (
    <div aria-hidden="true" className="mt-1.5 grid grid-cols-2 gap-1">
      <div className="flex h-1.5 justify-end overflow-hidden rounded-full bg-ground">
        <span className={`rounded-full ${tone("home")}`} style={{ width: `${homeShare}%` }} />
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-ground">
        <span className={`rounded-full ${tone("away")}`} style={{ width: `${awayShare}%` }} />
      </div>
    </div>
  );
}

function Row({ row }: { row: StatRow }) {
  const winner = favoured(row);
  const value = (side: "home" | "away") =>
    `min-w-0 text-[0.85rem] font-bold tabular-nums ${winner === side ? "text-accent" : "text-ink"}`;

  return (
    <div className="border-b border-line py-2.5 last:border-0">
      <p className="bc-label text-center text-[0.62rem] text-ink-faint">{row.label}</p>
      <div className="mt-1 grid grid-cols-2 gap-3">
        <span className={`${value("home")} text-left`}>{row.home}</span>
        <span className={`${value("away")} text-right`}>{row.away}</span>
      </div>
      <Bars row={row} />
    </div>
  );
}

/** Every fact and figure we hold about the two teams, side by side. */
export function TeamComparison({
  comparison,
  home,
  away,
}: {
  comparison: Comparison;
  home: Team;
  away: Team;
}) {
  return (
    <div className="space-y-4">
      <div className="bc-card bc-pad bc-shadow">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line pb-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <TeamBadge team={home} size="md" />
            <span className="min-w-0 text-[0.85rem] leading-tight font-black text-ink">{home.name}</span>
          </div>
          <span className="bc-label text-[0.62rem] text-ink-faint">vs</span>
          <div className="flex min-w-0 flex-row-reverse items-center gap-2.5">
            <TeamBadge team={away} size="md" />
            <span className="min-w-0 text-right text-[0.85rem] leading-tight font-black text-ink">{away.name}</span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line py-3">
          <FormDots form={comparison.form.home} />
          <span className="bc-label text-[0.62rem] text-ink-faint">Last five</span>
          <span className="flex justify-end">
            <FormDots form={comparison.form.away} />
          </span>
        </div>

        {comparison.groups.map((group) => (
          <section key={group.title} className="pt-4">
            <h2 className="bc-label text-[0.7rem] text-ink-muted">{group.title}</h2>
            {group.note ? <p className="mt-0.5 text-[0.7rem] text-ink-faint">{group.note}</p> : null}
            <div className="mt-1">
              {group.rows.map((row) => (
                <Row key={row.label} row={row} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {comparison.headToHead.length > 0 ? (
        <section>
          <h2 className="bc-label mb-3 px-1 text-[0.7rem] text-ink-muted">Also meeting this season</h2>
          <div className="space-y-2.5">
            {comparison.headToHead.map((match) => (
              <MatchRow key={match.id} match={match} showDate />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
