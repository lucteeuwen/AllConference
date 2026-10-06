import type { NamedTeam } from "@/lib/video";
import { BROADCASTS, SEASON_START } from "./config";
import { fetchJson, fetchWithRetry } from "./http";
import type { MatchRecord } from "./merge";
import { HOUR_MS, pickGame, type GamePick } from "./pick";

/**
 * Schools paste a link into each SIDEARM game, and for most Hudl network games
 * it is only the school's page there. Every Hudl vCloud network (the CCIW's and
 * other conferences') lists each game as a broadcast (created before kickoff,
 * same id through live and replay), so find this game's own and link to it.
 */

export type Broadcast = {
  id: string;
  /** The school's site slug on the network, e.g. "carthage". */
  site: string;
  title: string;
  /** ISO 8601 instant. */
  date: string;
  date_modified: string | null;
  /** False or true when the school has taken the broadcast down. */
  available?: boolean;
  hidden?: boolean;
  /** The portal it is watched on; the CCIW Network when not set. */
  portal?: string;
  /** The team whose site it is, when it is not one of the CCIW Network's. */
  team?: string;
};

type BroadcastPage = { num_pages: number; broadcasts: Broadcast[] };

/** One school's channel on a Hudl vCloud network. */
export type HudlSite = {
  portal: string;
  site: string;
  /** The team the site belongs to, so a title may leave it out. */
  team?: string;
};

/**
 * Within this of kickoff. The network's times are the school's own entry and
 * can be hours off SIDEARM's (3h45m seen), but the same two schools don't meet
 * twice in a day.
 */
const WINDOW_MS = 12 * HOUR_MS;

/** The CCIW Network's school sites. */
export function cciwSites(): HudlSite[] {
  return Object.entries(BROADCASTS.sites).map(([site, team]) => ({ portal: BROADCASTS.portal, site, team }));
}

/** The network channel a school links (`https://wiacnetwork.com/stevenspoint/`), when it is on Hudl vCloud. */
export function hudlSiteOf(raw: string | null | undefined): HudlSite | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (!BROADCASTS.portals.includes(host)) return null;
  const site = url.pathname.split("/").find(Boolean);
  return site && /^[\w-]+$/.test(site) ? { portal: `https://${host}`, site } : null;
}

/** One site's men's soccer broadcasts this season. */
async function fetchSite(site: HudlSite): Promise<Broadcast[]> {
  const found: Broadcast[] = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    const query = new URLSearchParams({
      site: site.site,
      section_id: String(BROADCASTS.section),
      after: SEASON_START,
      sortBy: "date",
      sortDir: "asc",
      page: String(page),
    });
    const result = await fetchJson<BroadcastPage>(`${BROADCASTS.api}?${query}`);
    pages = result.num_pages;
    for (const broadcast of result.broadcasts) {
      // The CCIW Network's own sites keep their team in config.
      const team = BROADCASTS.sites[broadcast.site] ? undefined : site.team;
      found.push({ ...broadcast, portal: site.portal, team });
    }
  }
  return found;
}

/**
 * Every listed site's broadcasts, and the sites that could not be read (by
 * lower-cased site name), so their games keep what they had.
 */
export async function fetchBroadcasts(sites: HudlSite[]): Promise<{ broadcasts: Broadcast[]; failed: Set<string> }> {
  const found = new Map<string, Broadcast>();
  const failed = new Set<string>();
  const seen = new Set<string>();
  for (const site of sites) {
    const key = site.site.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      for (const broadcast of await fetchSite(site)) found.set(broadcast.id, broadcast);
    } catch {
      failed.add(key);
    }
  }
  return { broadcasts: [...found.values()], failed };
}

/**
 * One broadcast as its player page describes it, for a link whose site we don't
 * list (a bare `vcloud.hudl.com/broadcast/embed/<id>`) or that a school filed
 * outside men's soccer. Null when the school has taken it down or it never was.
 */
export async function embeddedBroadcast(id: string): Promise<Pick<Broadcast, "title" | "date"> | null> {
  const response = await fetchWithRetry(`https://vcloud.hudl.com/broadcast/embed/${id}`);
  if (!response.ok) return null;
  const html = await response.text();
  const title = html.match(/property="og:title" content="([^"]*)"/)?.[1];
  const start = html.match(/start_time'\s*:\s*'?(\d+)/)?.[1];
  if (!title || !start) return null;
  return {
    title: title.replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"'),
    date: new Date(Number(start) * 1000).toISOString(),
  };
}

export function broadcastUrl(broadcast: Pick<Broadcast, "id" | "site" | "portal">): string {
  return `${broadcast.portal ?? BROADCASTS.portal}/${broadcast.site.toLowerCase()}/?B=${broadcast.id}`;
}

/**
 * The broadcast of this game, or none. It must be near kickoff and its title
 * must name both schools (the school whose site it is on may be left out); when
 * the network holds two for one game, the one closest to kickoff wins, then the
 * most recently edited.
 */
export function pickBroadcast(
  match: Pick<MatchRecord, "date" | "home_slug" | "away_slug" | "time_tbd">,
  broadcasts: Broadcast[],
  teams: NamedTeam[],
): GamePick {
  // Without a kickoff time the date is only an anchor; compare by day.
  const window = match.time_tbd ? 24 * HOUR_MS : WINDOW_MS;
  const candidates = broadcasts
    .filter((broadcast) => broadcast.available !== false && broadcast.hidden !== true)
    .map((broadcast) => ({
      url: broadcastUrl(broadcast),
      title: broadcast.title,
      date: broadcast.date,
      modified: broadcast.date_modified,
      implied: broadcast.team ?? BROADCASTS.sites[broadcast.site],
    }));
  return pickGame(match, candidates, teams, { before: window, after: window });
}
