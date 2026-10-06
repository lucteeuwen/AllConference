import { classifyVideo, isStandIn, titleVerdict, type NamedTeam } from "@/lib/video";
import { BROADCASTS, USER_AGENT } from "./config";
import { cciwSites, embeddedBroadcast, fetchBroadcasts, hudlSiteOf, pickBroadcast, type HudlSite } from "./broadcasts";
import type { MatchRecord } from "./merge";
import { pickVideo, videoStillFits, youtubeChannelOf, youtubeVideoId, YouTube, type Video } from "./youtube";

/**
 * Finds the link to each game's own stream or replay, wherever it is: a Hudl
 * network broadcast, a stream on a school's YouTube channel, a FloCollege event,
 * or the school's own link when it already is the game. A game with none of
 * these gets no link: a channel or team page is not the game.
 */

export type WatchSource = "hudl" | "youtube" | "flo" | "school";

export type WatchResult = {
  /** The game's own stream; null when there is none. */
  url: string | null;
  source?: WatchSource;
  /** False when a platform could not be asked this run, so the stored link should stay. */
  settled: boolean;
  /** Why, for the run log and the audit. */
  reason: string;
};

type Match = Pick<
  MatchRecord,
  "id" | "date" | "status" | "home_slug" | "away_slug" | "time_tbd" | "video_url" | "broadcast_url"
>;

const CCIW_TEAMS = new Set(Object.values(BROADCASTS.sites));

/**
 * The other networks' sites the schools link, each with its team when that is
 * clear: the side of the game that is not a CCIW Network school.
 */
function linkedSites(matches: Match[]): HudlSite[] {
  const cciw = new Set(Object.keys(BROADCASTS.sites).map((site) => site.toLowerCase()));
  const bySite = new Map<string, HudlSite & { teams: Set<string> }>();
  for (const match of matches) {
    const site = hudlSiteOf(match.video_url);
    if (!site || cciw.has(site.site.toLowerCase())) continue;
    const key = site.site.toLowerCase();
    const entry = bySite.get(key) ?? { ...site, teams: new Set<string>() };
    const others = [match.home_slug, match.away_slug].filter((slug) => slug && !CCIW_TEAMS.has(slug));
    if (others.length === 1) entry.teams.add(others[0] as string);
    bySite.set(key, entry);
  }
  return [...bySite.values()].map(({ teams, ...site }) => ({ ...site, team: teams.size === 1 ? [...teams][0] : undefined }));
}

/** The site names (lower-cased) a game's broadcast would be on. */
function sitesOf(match: Match): string[] {
  const sites = Object.entries(BROADCASTS.sites)
    .filter(([, team]) => team === match.home_slug || team === match.away_slug)
    .map(([site]) => site.toLowerCase());
  const linked = hudlSiteOf(match.video_url);
  if (linked) sites.push(linked.site.toLowerCase());
  return sites;
}

/** Where a FloCollege short link goes, and the page title of a FloCollege game. */
async function floPage(url: string): Promise<{ url: string; title: string | null }> {
  let target = url;
  if (new URL(url).hostname === "flosports.link") {
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    const location = response.headers.get("location");
    if (!location) throw new Error(`no redirect from ${url}`);
    target = classifyVideo(new URL(location, url).toString())?.url ?? location;
  }
  const response = await fetch(target, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AllConference/1.0)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return { url: target, title: null };
  const title = (await response.text()).match(/<title>([^<]*)<\/title>/)?.[1] ?? null;
  return { url: target, title: title?.replace(/^Stream /, "").replace(/ - FloCollege$/, "") ?? null };
}

export type ResolveOptions = {
  teams: NamedTeam[];
  log: (message: string) => void;
  youtube?: YouTube | null;
};

export async function resolveWatchLinks(matches: Match[], options: ResolveOptions): Promise<Map<string, WatchResult>> {
  const { teams, log } = options;
  const youtube = options.youtube === undefined ? (YouTube.available() ? new YouTube() : null) : options.youtube;

  const { broadcasts, failed } = await fetchBroadcasts([...cciwSites(), ...linkedSites(matches)]);
  if (failed.size) log(`WARN Hudl sites unreadable, keeping their games' links: ${[...failed].join(", ")}`);
  // An empty list means the API changed, not that every game lost its broadcast.
  const hudlDown = broadcasts.length === 0;
  if (hudlDown) log("WARN Hudl networks returned no broadcasts, keeping stored links");

  // Direct links to one video, checked together.
  const directIds = new Set<string>();
  for (const match of matches) {
    const video = classifyVideo(match.video_url);
    if (video?.provider === "youtube" && video.embedUrl) directIds.add(youtubeVideoId(video.url) ?? "");
  }
  directIds.delete("");
  let direct: Map<string, Video> | null = null;
  if (youtube && directIds.size) {
    try {
      direct = new Map((await youtube.videos([...directIds])).map((video) => [video.id, video]));
    } catch (error) {
      log(`WARN YouTube videos: ${(error as Error).message}`);
    }
  }

  const results = new Map<string, WatchResult>();
  for (const match of matches) {
    results.set(match.id, await resolveOne(match));
  }
  return results;

  async function resolveOne(match: Match): Promise<WatchResult> {
    if (!match.home_slug || !match.away_slug || isStandIn(match.home_slug) || isStandIn(match.away_slug)) {
      return { url: null, settled: true, reason: "a side is not decided" };
    }
    const playing = [match.home_slug, match.away_slug];

    const hudl = pickBroadcast(match, broadcasts, teams);
    if (hudl.candidates > 1) log(`${match.id}: ${hudl.candidates} Hudl broadcasts fit, using ${hudl.url}`);
    if (hudl.url) return { url: hudl.url, source: "hudl", settled: true, reason: "Hudl broadcast" };
    const hudlSettled = !hudlDown && !sitesOf(match).some((site) => failed.has(site));

    const video = classifyVideo(match.video_url);
    if (!video) {
      return { url: null, settled: hudlSettled, reason: match.video_url ? "school link unreadable" : "no link anywhere" };
    }

    if (video.provider === "youtube" && !video.embedUrl) {
      const channel = youtubeChannelOf(video.url);
      if (!channel) return { url: null, settled: hudlSettled, reason: "YouTube page that is not a channel" };
      // A replay found once does not move; save the quota for games still to come.
      const stored = match.broadcast_url && youtubeVideoId(match.broadcast_url);
      if (stored && match.status === "final") {
        return { url: match.broadcast_url ?? null, source: "youtube", settled: true, reason: "YouTube replay found earlier" };
      }
      if (!youtube) return { url: null, settled: false, reason: "YouTube channel, no API key" };
      try {
        const videos = await youtube.channelVideos(channel);
        const pick = pickVideo(match, videos, teams, match.home_slug);
        if (pick.candidates > 1) log(`${match.id}: ${pick.candidates} YouTube videos fit, using ${pick.url}`);
        if (pick.url) return { url: pick.url, source: "youtube", settled: true, reason: "stream on the school's channel" };
        return { url: null, settled: hudlSettled, reason: "no video of this game on the channel" };
      } catch (error) {
        log(`WARN ${match.id}: ${(error as Error).message}`);
        return { url: null, settled: false, reason: "YouTube unreachable" };
      }
    }

    if (!video.exact) return { url: null, settled: hudlSettled, reason: `only a page on ${video.platform}` };

    if (video.broadcastId) {
      // Not in any list we read: on a site we don't list, filed under another
      // sport, or taken down. Its own player page says which.
      try {
        const broadcast = await embeddedBroadcast(video.broadcastId);
        const pick = broadcast
          ? pickBroadcast(match, [{ ...broadcast, id: video.broadcastId, site: "", date_modified: null }], teams)
          : null;
        if (pick?.url) return { url: video.url, source: "school", settled: true, reason: `school's Hudl link (${broadcast?.title})` };
        return {
          url: null,
          settled: true,
          reason: broadcast ? `school's Hudl link is another game (${broadcast.title})` : "school's Hudl link is taken down",
        };
      } catch (error) {
        log(`WARN ${match.id}: Hudl broadcast ${video.broadcastId}: ${(error as Error).message}`);
        return { url: null, settled: false, reason: "Hudl unreachable" };
      }
    }

    if (video.provider === "youtube") {
      if (!direct) return { url: video.url, source: "school", settled: true, reason: "school's YouTube video (unchecked)" };
      const found = direct.get(youtubeVideoId(video.url) ?? "");
      return videoStillFits(found, playing, teams)
        ? { url: video.url, source: "school", settled: true, reason: "school's YouTube video" }
        : { url: null, settled: true, reason: "school's YouTube video is gone or another game" };
    }

    if (video.provider === "flo") {
      try {
        const page = await floPage(video.url);
        if (/womens?\b/i.test(decodeURIComponent(page.url))) {
          return { url: null, settled: true, reason: "FloCollege link is a women's game" };
        }
        if (page.title && titleVerdict(page.title, playing, teams) === "mismatch") {
          return { url: null, settled: true, reason: `FloCollege link is another game (${page.title})` };
        }
        return { url: page.url, source: "flo", settled: true, reason: "FloCollege event" };
      } catch (error) {
        log(`WARN ${match.id}: FloCollege ${(error as Error).message}`);
        return { url: null, settled: false, reason: "FloCollege unreachable" };
      }
    }

    return { url: video.url, source: "school", settled: true, reason: `school's link to the game on ${video.platform}` };
  }
}
