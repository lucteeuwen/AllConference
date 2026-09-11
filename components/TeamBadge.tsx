import { readableInk } from "@/lib/color";
import type { Team } from "@/lib/types";

const sizes = {
  xs: { box: 24, text: 9 },
  sm: { box: 32, text: 11 },
  md: { box: 44, text: 14 },
  lg: { box: 64, text: 19 },
  xl: { box: 76, text: 22 },
} as const;

type Props = {
  team: Team;
  size?: keyof typeof sizes;
  /** A thin light ring reads better against the navy hero. */
  ring?: boolean;
};

/**
 * Stands in for a school crest. Real logos are licensed assets, so the dummy
 * data uses the school's colour plus its abbreviation instead.
 */
export function TeamBadge({ team, size = "md", ring = false }: Props) {
  const { box, text } = sizes[size];

  return (
    <span
      aria-hidden="true"
      className="team-color inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight"
      style={{
        width: box,
        height: box,
        background: team.primary,
        color: readableInk(team.primary),
        fontSize: text,
        boxShadow: ring
          ? "0 0 0 2px rgba(255,255,255,0.55)"
          : "inset 0 0 0 1px rgba(0,0,0,0.08)",
      }}
    >
      {team.abbr}
    </span>
  );
}
