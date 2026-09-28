import type { ReactNode } from "react";
import Link from "next/link";
import { playerHref } from "@/lib/players";
import type { Player } from "@/lib/types";

/**
 * A player's name, linked to their page when we have one (conference rosters
 * only; opponents from outside the conference stay plain text).
 */
export function PlayerLink({
  player,
  children,
  className = "",
}: {
  player: Pick<Player, "id"> | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  if (!player) return <span className={className}>{children}</span>;
  return (
    <Link
      href={playerHref(player)}
      className={`underline-offset-2 transition hover:text-accent hover:underline ${className}`}
    >
      {children}
    </Link>
  );
}
