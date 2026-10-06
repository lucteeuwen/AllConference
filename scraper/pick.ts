import { titleNamesBoth, type NamedTeam } from "@/lib/video";
import type { MatchRecord } from "./merge";

/**
 * Picking one game's broadcast out of a platform's list, by when it is and what
 * its title says. Shared by every platform the scraper searches.
 */

export type Candidate = {
  url: string;
  title: string;
  /** ISO 8601 instant the broadcast starts (or was published). */
  date: string;
  /** Breaks a tie between two for one game: the most recently edited wins. */
  modified?: string | null;
  /** A side the title may leave out because the page it is on says whose it is. */
  implied?: string;
};

/** How far a candidate may start from kickoff: `before` it, `after` it. */
export type Window = { before: number; after: number };

export type GamePick = { url: string | null; candidates: number };

export const HOUR_MS = 60 * 60_000;

/** Clips and placeholders the schools also file under the sport. */
export const NOT_A_GAME = /\b(interview|highlights?|post[- ]?(game|match)|pre[- ]?(game|match)|press conference|test|opponent|scrimmage|reserves?)\b/i;

/**
 * The candidate for this game, or none. It must start within the window, not
 * be a clip, and its title must name both sides (or the other side, when one is
 * implied). When two fit, the one closest to kickoff wins.
 */
export function pickGame(
  match: Pick<MatchRecord, "date" | "home_slug" | "away_slug">,
  candidates: Candidate[],
  teams: NamedTeam[],
  window: Window,
): GamePick {
  if (!match.home_slug || !match.away_slug) return { url: null, candidates: 0 };
  const playing = [match.home_slug, match.away_slug];
  const kickoff = Date.parse(match.date);

  const fits = candidates
    .filter((candidate) => {
      const offset = Date.parse(candidate.date) - kickoff;
      return (
        offset >= -window.before &&
        offset <= window.after &&
        !NOT_A_GAME.test(candidate.title) &&
        titleNamesBoth(candidate.title, playing, teams, candidate.implied)
      );
    })
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.date) - kickoff) - Math.abs(Date.parse(b.date) - kickoff) ||
        (b.modified ?? "").localeCompare(a.modified ?? "") ||
        a.url.localeCompare(b.url),
    );

  return { url: fits[0]?.url ?? null, candidates: fits.length };
}
