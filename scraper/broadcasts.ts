import type { Team } from "@/lib/types";
import { titleNamesBoth } from "@/lib/video";
import { BROADCASTS, SEASON_START } from "./config";
import { fetchJson } from "./http";
import type { MatchRecord } from "./merge";

/**
 * Schools paste a link into each SIDEARM game, and for most CCIW Network games
 * it is only the school's page there. The network lists every game as a
 * broadcast (created before kickoff, same id through live and replay), so find
 * this game's own and link straight to it.
 */

export type Broadcast = {
  id: string;
  /** The school's site slug on the network, e.g. "carthage". */
  site: string;
  title: string;
  /** ISO 8601 instant. */
  date: string;
  date_modified: string | null;
};

type BroadcastPage = { num_pages: number; broadcasts: Broadcast[] };

/**
 * Within this of kickoff. The network's times are the school's own entry and
 * can be hours off SIDEARM's (3h45m seen), but the same two schools don't meet
 * twice in a day.
 */
const WINDOW_MS = 12 * 60 * 60_000;

/** Clips and placeholders the schools also file under the sport. */
const NOT_A_GAME = /\b(interview|highlights?|postgame|pregame|press conference|test|opponent)\b/i;

export async function fetchBroadcasts(): Promise<Broadcast[]> {
  const found = new Map<string, Broadcast>();
  for (const site of Object.keys(BROADCASTS.sites)) {
    for (let page = 1, pages = 1; page <= pages; page++) {
      const query = new URLSearchParams({
        site,
        section_id: String(BROADCASTS.section),
        after: SEASON_START,
        sortBy: "date",
        sortDir: "asc",
        page: String(page),
      });
      const result = await fetchJson<BroadcastPage>(`${BROADCASTS.api}?${query}`);
      pages = result.num_pages;
      for (const broadcast of result.broadcasts) found.set(broadcast.id, broadcast);
    }
  }
  return [...found.values()];
}

export function broadcastUrl(broadcast: Pick<Broadcast, "id" | "site">): string {
  return `${BROADCASTS.portal}/${broadcast.site.toLowerCase()}/?B=${broadcast.id}`;
}

export type BroadcastPick = { url: string | null; candidates: number };

/**
 * The broadcast of this game, or none. It must be near kickoff and its title
 * must name both schools (the host may be implied by the site it is on); when the network holds two for one game, the one
 * closest to kickoff wins, then the most recently edited.
 */
export function pickBroadcast(
  match: Pick<MatchRecord, "date" | "home_slug" | "away_slug" | "time_tbd">,
  broadcasts: Broadcast[],
  teams: Pick<Team, "slug" | "name" | "fullName">[],
): BroadcastPick {
  if (!match.home_slug || !match.away_slug) return { url: null, candidates: 0 };
  const playing = [match.home_slug, match.away_slug];
  const kickoff = Date.parse(match.date);
  // Without a kickoff time the date is only an anchor; compare by day.
  const window = match.time_tbd ? 24 * 60 * 60_000 : WINDOW_MS;

  const candidates = broadcasts
    .filter(
      (broadcast) =>
        Math.abs(Date.parse(broadcast.date) - kickoff) <= window &&
        !NOT_A_GAME.test(broadcast.title) &&
        // Many titles leave out the host ("Men's Soccer vs Carroll University"): its site says it.
        titleNamesBoth(broadcast.title, playing, teams, BROADCASTS.sites[broadcast.site]),
    )
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.date) - kickoff) - Math.abs(Date.parse(b.date) - kickoff) ||
        (b.date_modified ?? "").localeCompare(a.date_modified ?? "") ||
        a.id.localeCompare(b.id),
    );

  return { url: candidates[0] ? broadcastUrl(candidates[0]) : null, candidates: candidates.length };
}
