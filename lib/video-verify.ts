import "server-only";
import { titleVerdict } from "@/lib/video";
import type { Match, MatchVideo, Team } from "@/lib/types";

/**
 * Schools paste a link into each game, and some point at the wrong broadcast (a
 * women's game, another opponent's, an old link reused) or only at a channel.
 * The scraper only stores a link it matched to the game, but a school can hide
 * or delete a broadcast after that. Before showing a "watch" link, check it
 * against what the platform says now, and show nothing when it can't be
 * confirmed rather than a game that may be the wrong one.
 */

const USER_AGENT = "Mozilla/5.0 (compatible; AllConference/1.0)";
const TIMEOUT_MS = 3000;
/** Titles rarely change; a day keeps every match page from asking again. */
const REVALIDATE_S = 6 * 60 * 60;

function decode(text: string): string {
  return text.replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

/** The broadcast's title, or null when the platform has none for that id. Throws when it can't be reached. */
async function hudlTitle(id: string): Promise<string | null> {
  const response = await fetch(`https://vcloud.hudl.com/broadcast/embed/${id}`, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: REVALIDATE_S },
  });
  if (!response.ok) return null;
  const html = await response.text();
  const title = html.match(/property="og:title" content="([^"]*)"/)?.[1];
  return title ? decode(title) : null;
}

/**
 * The video's title, or "gone" when YouTube has no public video at that address,
 * or "no-embed" when the owner doesn't allow it to play on other sites.
 */
async function youtubeInfo(url: string): Promise<{ title: string; channel?: string } | "gone" | "no-embed" | null> {
  const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: REVALIDATE_S },
  });
  if (response.status === 404 || response.status === 400) return "gone";
  if (response.status === 401 || response.status === 403) return "no-embed";
  if (!response.ok) return null;
  const data = (await response.json()) as { title?: string; author_url?: string };
  return data.title ? { title: data.title, channel: data.author_url } : null;
}

/** FloCollege event links and short links carry the sport in their address. */
async function floLooksWomens(url: string): Promise<boolean> {
  let target = url;
  if (new URL(url).hostname === "flosports.link") {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_S },
    });
    target = response.headers.get("location") ?? url;
  }
  return /womens?\b/i.test(decodeURIComponent(target));
}

/** The link to show for this match: kept when confirmed, otherwise none. */
export async function verifyVideo(
  video: MatchVideo | undefined,
  match: Match,
  teams: Team[],
): Promise<MatchVideo | undefined> {
  if (!video?.exact) return undefined;

  const playing = [match.home.teamSlug, match.away.teamSlug].filter((slug): slug is string => Boolean(slug));

  try {
    if (video.broadcastId) {
      const title = await hudlTitle(video.broadcastId);
      // No title (hidden or deleted), or one for another game.
      return title && titleVerdict(title, playing, teams) === "match" ? video : undefined;
    }

    if (video.provider === "youtube" && video.embedUrl) {
      const info = await youtubeInfo(video.url);
      if (info === "gone") return undefined;
      // Still this game's video, but only YouTube itself will play it.
      if (info === "no-embed") return { ...video, embedUrl: undefined };
      // A school's own upload with a generic title stays; a contradiction does not.
      if (info && titleVerdict(info.title, playing, teams) === "mismatch") return undefined;
      return video;
    }

    if (video.provider === "flo" && (await floLooksWomens(video.url))) return undefined;
  } catch {
    // The platform couldn't be reached just now: that says nothing about the link.
  }
  return video;
}
