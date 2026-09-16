import Image from "next/image";
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
 * The school's logo on a white chip, so dark crests stay legible on the navy
 * hero and in dark mode. Teams without a logo (and TBC sides) fall back to a
 * coloured circle with the school's abbreviation.
 */
export function TeamBadge({ team, size = "md", ring = false }: Props) {
  const { box, text } = sizes[size];
  const frame = {
    width: box,
    height: box,
    borderRadius: "var(--badge-radius)",
    boxShadow: ring ? "0 0 0 2px rgba(255,255,255,0.55)" : "inset 0 0 0 1px rgba(0,0,0,0.08)",
  };

  if (team.logoUrl) {
    const inset = Math.max(2, Math.round(box * 0.1));
    return (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center overflow-hidden bg-white"
        style={{ ...frame, padding: inset }}
      >
        <Image
          src={team.logoUrl}
          alt=""
          width={box - inset * 2}
          height={box - inset * 2}
          className="size-full object-contain"
          unoptimized={team.logoUrl.split("?")[0].endsWith(".svg")}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="team-color inline-flex shrink-0 items-center justify-center font-bold tracking-tight"
      style={{
        ...frame,
        background: team.primary,
        color: readableInk(team.primary),
        fontSize: text,
      }}
    >
      {team.abbr}
    </span>
  );
}
