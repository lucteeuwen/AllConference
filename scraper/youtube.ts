import { titleVerdict, type NamedTeam } from "@/lib/video";
import { SEASON_START, YOUTUBE } from "./config";
import type { MatchRecord } from "./merge";
import { HOUR_MS, pickGame, type GamePick } from "./pick";

/**
 * Some schools link their YouTube channel instead of the game. Their games are
 * streams on that channel, so find the one that started at kickoff and names
 * both schools. Titles often leave out the sport ("Wheaton vs Millikin | FULL
 * BROADCAST"), so the start time does most of the work.
 */

export type ChannelRef = { handle?: string; id?: string; username?: string };

export type Video = {
  id: string;
  title: string;
  /** When the stream started (or was set to); for an upload, when it was published. */
  start: string;
  live: boolean;
};

/** Path segments of youtube.com that are pages of YouTube, not a channel. */
const NOT_A_CHANNEL = new Set(["watch", "live", "embed", "shorts", "playlist", "results", "feed", "redirect"]);

/** The channel a link points at, when it points at a channel rather than a video. */
export function youtubeChannelOf(raw: string | null | undefined): ChannelRef | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^(www\.|m\.)?youtube\.com$/.test(url.hostname)) return null;
  const [first, second] = url.pathname.split("/").filter(Boolean);
  if (!first || url.searchParams.has("v")) return null;
  if (first.startsWith("@")) return { handle: decodeURIComponent(first) };
  if (first === "channel") return second && /^UC[\w-]{22}$/.test(second) ? { id: second } : null;
  if (first === "user") return second ? { username: second } : null;
  if (first === "c") return second ? { handle: `@${second}` } : null;
  return NOT_A_CHANNEL.has(first) ? null : { handle: `@${first}`, username: first };
}

/** The video id a link plays, when it is one video. */
export function youtubeVideoId(raw: string): string | null {
  return raw.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed|live|shorts)\/|[?&]v=|youtu\.be\/)([\w-]{11})/)?.[1] ?? null;
}

export function videoUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** A live stream starts a little before kickoff, rarely after it. */
const LIVE_WINDOW = { before: 2 * HOUR_MS, after: 1 * HOUR_MS };
/** An upload goes up after the game, on the same day. */
const UPLOAD_WINDOW = { before: 0, after: 10 * HOUR_MS };

/**
 * The video of this game, or none. A stream is matched to kickoff; an upload,
 * which may be any of the school's games that day, only when it is the only
 * one that fits.
 */
export function pickVideo(
  match: Pick<MatchRecord, "date" | "home_slug" | "away_slug" | "time_tbd">,
  videos: Video[],
  teams: NamedTeam[],
  /** The team whose channel it is, so a title may leave it out. */
  owner?: string,
): GamePick {
  // A day anchor says nothing about which of a day's streams is this game.
  if (match.time_tbd) return { url: null, candidates: 0 };
  const candidates = (live: boolean) =>
    videos
      .filter((video) => video.live === live)
      .map((video) => ({ url: videoUrl(video.id), title: video.title, date: video.start, implied: owner }));

  const stream = pickGame(match, candidates(true), teams, LIVE_WINDOW);
  if (stream.url) return stream;
  const upload = pickGame(match, candidates(false), teams, UPLOAD_WINDOW);
  return upload.candidates === 1 ? upload : { url: null, candidates: upload.candidates };
}

type ChannelList = { items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[] };
type PlaylistPage = {
  nextPageToken?: string;
  items: { contentDetails: { videoId: string; videoPublishedAt?: string } }[];
};
type VideoList = {
  items: {
    id: string;
    snippet: { title: string; publishedAt: string };
    liveStreamingDetails?: { actualStartTime?: string; scheduledStartTime?: string };
  }[];
};

/** Uploads are newest first; a channel with every sport on it still ends within this. */
const MAX_PAGES = 12;

export class YouTube {
  private uploads = new Map<string, Promise<Video[]>>();

  constructor(private key: string = YOUTUBE.key ?? "") {}

  static available(): boolean {
    return Boolean(YOUTUBE.key);
  }

  /** The key goes in a header, so it never shows up in a logged URL. */
  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const response = await fetch(`${YOUTUBE.api}/${path}?${new URLSearchParams(params)}`, {
      headers: { "x-goog-api-key": this.key, accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`YouTube ${path}: ${response.status}`);
    return (await response.json()) as T;
  }

  private async uploadsPlaylist(ref: ChannelRef): Promise<string | null> {
    const tries: Record<string, string>[] = [];
    if (ref.id) tries.push({ id: ref.id });
    if (ref.handle) tries.push({ forHandle: ref.handle });
    if (ref.username) tries.push({ forUsername: ref.username });
    for (const lookup of tries) {
      const list = await this.get<ChannelList>("channels", { part: "contentDetails", ...lookup });
      const uploads = list.items?.[0]?.contentDetails.relatedPlaylists.uploads;
      if (uploads) return uploads;
    }
    return null;
  }

  /** The channel's videos this season (streams and uploads), read once per run. */
  channelVideos(ref: ChannelRef): Promise<Video[]> {
    const key = JSON.stringify(ref);
    let pending = this.uploads.get(key);
    if (!pending) {
      pending = this.readChannel(ref);
      // A failure is not remembered, so the next game can try again.
      pending.catch(() => this.uploads.delete(key));
      this.uploads.set(key, pending);
    }
    return pending;
  }

  private async readChannel(ref: ChannelRef): Promise<Video[]> {
    const playlist = await this.uploadsPlaylist(ref);
    if (!playlist) throw new Error(`YouTube channel ${JSON.stringify(ref)} not found`);

    const ids: string[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.get<PlaylistPage>("playlistItems", {
        part: "contentDetails",
        playlistId: playlist,
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      });
      let older = false;
      for (const item of result.items) {
        const published = item.contentDetails.videoPublishedAt;
        // Not yet published: a stream scheduled for later.
        if (published && published < SEASON_START) older = true;
        else ids.push(item.contentDetails.videoId);
      }
      pageToken = result.nextPageToken;
      if (older || !pageToken) break;
    }
    return this.videos(ids);
  }

  /** Title and start time of these videos; one that is gone is left out. */
  async videos(ids: string[]): Promise<Video[]> {
    const out: Video[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const result = await this.get<VideoList>("videos", {
        part: "snippet,liveStreamingDetails",
        id: ids.slice(i, i + 50).join(","),
      });
      for (const item of result.items) {
        const live = item.liveStreamingDetails;
        out.push({
          id: item.id,
          title: item.snippet.title,
          start: live?.actualStartTime ?? live?.scheduledStartTime ?? item.snippet.publishedAt,
          live: Boolean(live),
        });
      }
    }
    return out;
  }
}

/** A link to one video stays unless YouTube no longer has it or its title is another game. */
export function videoStillFits(video: Video | undefined, playing: string[], teams: NamedTeam[]): boolean {
  return Boolean(video) && titleVerdict((video as Video).title, playing, teams) !== "mismatch";
}
