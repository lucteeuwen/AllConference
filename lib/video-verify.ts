import "server-only";
import { platformFallback, titleVerdict } from "@/lib/video";
import type { Match, MatchVideo, Team } from "@/lib/types";

/**
 * Schools paste a link into each game, and some point at the wrong broadcast (a
 * women's game, another opponent's, an old link reused) or only at a channel.
 * Before showing a "watch" link for a game, check it against what the platform
 * itself says the broadcast is. When it can't be confirmed, send the reader to
 * the platform rather than to a game that may be the wrong one.
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

async function youtubeInfo(url: string): Promise<{ title: string; channel?: string } | null> {
  const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: REVALIDATE_S },
  });
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

/** The link to show for this match: kept when confirmed, otherwise the platform's page. */
export async function verifyVideo(
  video: MatchVideo | undefined,
  match: Match,
  teams: Team[],
): Promise<MatchVideo | undefined> {
  if (!video || !video.exact) return video;

  const playing = [match.home.teamSlug, match.away.teamSlug].filter((slug): slug is string => Boolean(slug));

  try {
    if (video.broadcastId) {
      const title = await hudlTitle(video.broadcastId);
      // No title, or one for another game: we can't say this is the right broadcast.
      if (!title || titleVerdict(title, playing, teams) !== "match") return platformFallback(video);
      return video;
    }

    if (video.provider === "youtube" && video.embedUrl) {
      const info = await youtubeInfo(video.url);
      // A school's own upload with a generic title stays; a contradiction does not.
      if (info && titleVerdict(info.title, playing, teams) === "mismatch") {
        return platformFallback(video, info.channel);
      }
      return video;
    }

    if (video.provider === "flo" && (await floLooksWomens(video.url))) return platformFallback(video);
  } catch {
    // The platform couldn't be reached just now: that says nothing about the link.
  }
  return video;
}
