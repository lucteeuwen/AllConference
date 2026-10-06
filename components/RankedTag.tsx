import type { Team } from "@/lib/types";

type Props = {
  team: Team;
  /** White-on-glass styling for the navy match hero. */
  onDark?: boolean;
};

/** "#7" beside a team's name when it is in the national poll; nothing otherwise. */
export function RankedTag({ team, onDark = false }: Props) {
  if (team.nationalRank == null) return null;
  return (
    <span
      title={`Ranked #${team.nationalRank} nationally`}
      aria-label={`Ranked number ${team.nationalRank} nationally`}
      className={`bc-label inline-flex shrink-0 items-center rounded-control px-1.5 py-0.5 text-[0.62rem] leading-none tabular-nums ${
        onDark ? "bg-white/15 text-white" : "bg-accent/10 text-accent"
      }`}
    >
      #{team.nationalRank}
    </span>
  );
}
