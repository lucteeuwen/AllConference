import { readableInk } from "@/lib/color";
import type { Player, Team } from "@/lib/types";

/**
 * The school's headshot, cropped square from the top the way SIDEARM's own
 * roster cards ask for it. Without one, the shirt number on the team colour.
 */
export function PlayerPhoto({
  player,
  team,
  photoUrl,
  size,
}: {
  player: Player;
  team: Team;
  photoUrl: string | null;
  size: number;
}) {
  const frame = {
    width: size,
    height: size,
    borderRadius: "var(--card-radius)",
    boxShadow: "0 0 0 3px rgba(255,255,255,0.55), 0 12px 30px rgba(0,0,0,0.35)",
  };

  if (photoUrl) {
    // Twice the box for sharp screens; SIDEARM resizes on the fly.
    const src = photoUrl.includes("?")
      ? photoUrl
      : `${photoUrl}?width=${size * 2}&height=${size * 2}&mode=crop&anchor=topcenter`;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- each school hosts its own photos, and already resizes them
      <img
        src={src}
        alt={`${player.name}, ${team.name}`}
        width={size}
        height={size}
        className="shrink-0 bg-white/10 object-cover object-top"
        style={frame}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={`${player.name}, ${team.name}`}
      className="team-color inline-flex shrink-0 items-center justify-center font-black tabular-nums"
      style={{
        ...frame,
        background: team.primary,
        color: readableInk(team.primary),
        fontSize: size * 0.42,
      }}
    >
      {player.number ?? team.abbr}
    </span>
  );
}
