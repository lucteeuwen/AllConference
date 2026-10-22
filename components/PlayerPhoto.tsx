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
  compact = false,
}: {
  player: Player;
  team: Team;
  photoUrl: string | null;
  size: number;
  /** A small list headshot on the team colour, loaded lazily, rather than the hero's ringed portrait. */
  compact?: boolean;
}) {
  const frame = {
    width: size,
    height: size,
    borderRadius: "var(--card-radius)",
    boxShadow: compact
      ? "inset 0 0 0 1px rgba(0,0,0,0.08)"
      : "0 0 0 3px rgba(255,255,255,0.55), 0 12px 30px rgba(0,0,0,0.35)",
  };

  if (photoUrl) {
    // The scraper stores a 256px square crop with a `?v=` version on its URL.
    // A bare school URL is a photo not cached yet: SIDEARM resizes it on the fly.
    const src = photoUrl.includes("?")
      ? photoUrl
      : `${photoUrl}?width=${size * 2}&height=${size * 2}&mode=crop&anchor=topcenter`;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- already cropped to size by the scraper, so the optimizer has nothing to add
      <img
        src={src}
        // In a list the name sits beside it, so the photo stays silent.
        alt={compact ? "" : `${player.name}, ${team.name}`}
        width={size}
        height={size}
        decoding="async"
        loading={compact ? "lazy" : undefined}
        fetchPriority={compact ? undefined : "high"}
        className={`shrink-0 object-cover object-top ${compact ? "" : "bg-white/10"}`}
        style={compact ? { ...frame, background: team.primary } : frame}
      />
    );
  }

  return (
    <span
      role={compact ? undefined : "img"}
      aria-label={compact ? undefined : `${player.name}, ${team.name}`}
      aria-hidden={compact || undefined}
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
