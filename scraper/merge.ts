import type { MatchStage, MatchStatus } from "@/lib/types";
import { SEASON } from "./config";
import { abbreviate, centralDay, cleanText, shortName, slugify } from "./normalize";
import { zoneForLocation } from "./timezones";
import type { RawGame, RawRound } from "./sidearm/schedule";

export type TeamRow = {
  slug: string;
  name: string;
  full_name: string;
  abbr: string;
  location: string;
  venue: string;
  /** IANA zone of the school's own ground; null for one we could not place. */
  timezone: string | null;
  is_conference: boolean;
  sidearm_base_url: string | null;
  sidearm_sport_id: number | null;
  aliases: string[];
  logo_url: string | null;
  logo_source_url: string | null;
};

export type NewTeam = {
  slug: string;
  name: string;
  full_name: string;
  abbr: string;
  location: string;
  timezone: string | null;
  is_conference: false;
  logoSource: string | null;
};

export type MatchRecord = {
  id: string;
  season: number;
  date: string;
  status: MatchStatus;
  home_slug: string | null;
  away_slug: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_score: number | null;
  away_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  venue: string;
  /** IANA zone of this game's ground; null means "the home side's own zone". */
  timezone: string | null;
  /** No kickoff published yet: `date` is a day anchor, not a time. */
  time_tbd: boolean;
  is_conference: boolean;
  stage: MatchStage;
  bracket_slot: string | null;
  video_url: string | null;
  boxscore_url: string | null;
  recap_url: string | null;
  source_school: string;
  source_game_id: number;
  /** Not stored: CCIW tournament games still need a round and a slot. */
  cciw?: boolean;
  round?: RawRound | null;
};

/** Maps the many spellings in the feeds onto team slugs. */
export class TeamResolver {
  private byAlias = new Map<string, string>();
  readonly created = new Map<string, NewTeam>();
  /** Logo candidates seen in the feeds, first one wins. */
  readonly logoSources = new Map<string, string>();

  constructor(private teams: TeamRow[]) {
    for (const team of teams) {
      for (const alias of [team.full_name, ...(team.is_conference ? [team.name, ...team.aliases] : [])]) {
        this.byAlias.set(alias.toLowerCase(), team.slug);
      }
      if (!team.is_conference) this.byAlias.set(`slug:${team.slug}`, team.slug);
    }
  }

  isConference(slug: string | null): boolean {
    return this.teams.some((team) => team.slug === slug && team.is_conference);
  }

  /** `homeCity` is the opponent's own "City, St.", and only when they host. */
  resolve(name: string, logo: string | null, homeCity?: string): string {
    const clean = cleanText(name);
    const known = this.byAlias.get(clean.toLowerCase());
    if (known) {
      if (logo && !this.logoSources.has(known)) this.logoSources.set(known, logo);
      return known;
    }

    // Non-conference opponent: key on the short name so "Calvin" and
    // "Calvin University" from two schools' feeds land on one team.
    const short = shortName(clean);
    const slug = slugify(short);
    if (!this.byAlias.has(`slug:${slug}`)) {
      const city = cleanText(homeCity);
      this.created.set(slug, {
        slug,
        name: short,
        full_name: clean,
        abbr: abbreviate(clean),
        location: city,
        timezone: city ? zoneForLocation(city) : null,
        is_conference: false,
        logoSource: logo,
      });
      this.byAlias.set(`slug:${slug}`, slug);
    }
    this.byAlias.set(clean.toLowerCase(), slug);
    if (logo && !this.logoSources.has(slug)) this.logoSources.set(slug, logo);
    return slug;
  }

  venueFor(slug: string): string {
    return this.teams.find((team) => team.slug === slug && team.is_conference)?.venue ?? "";
  }

  /** The school's own zone, including one created earlier in this run. */
  zoneFor(slug: string): string | null {
    return (
      this.teams.find((team) => team.slug === slug)?.timezone ??
      this.created.get(slug)?.timezone ??
      null
    );
  }
}

const STATUS_RANK: Record<MatchStatus, number> = {
  scheduled: 0,
  postponed: 1,
  canceled: 1,
  live: 2,
  final: 3,
};

type Resolved = RawGame & { opponentSlug: string };

function pickPrimary(records: Resolved[]): Resolved {
  return (
    records.find((record) => record.indicator === "H") ??
    [...records].sort((a, b) => a.sourceSchool.localeCompare(b.sourceSchool)).find((record) => record.indicator === "N") ??
    records[0]
  );
}

/**
 * Collapses every school's view of a game into one match. The host's record
 * wins for kickoff, score, box score and stream (the host produces them); the
 * visitor's record fills whatever the host left out.
 */
export function mergeGames(raws: RawGame[], resolver: TeamResolver): {
  matches: MatchRecord[];
  placeholders: RawGame[];
} {
  const groups = new Map<string, Resolved[]>();
  const placeholders: RawGame[] = [];

  for (const raw of raws) {
    if (raw.placeholderRound) {
      placeholders.push(raw);
      continue;
    }
    // On the road, the feed's location is the opponent's own city.
    const opponentSlug = resolver.resolve(
      raw.opponentName,
      raw.opponentImage,
      raw.indicator === "A" ? raw.location : undefined,
    );
    if (opponentSlug === raw.sourceSchool) continue;
    const pair = [raw.sourceSchool, opponentSlug].sort().join("|");
    // Kind stays out of the key: one school may tag a tournament game that
    // the other lists as a plain fixture.
    const key = `${centralDay(raw.date)}|${pair}`;
    const group = groups.get(key) ?? [];
    group.push({ ...raw, opponentSlug });
    groups.set(key, group);
  }

  const matches: MatchRecord[] = [];

  for (const records of groups.values()) {
    const primary = pickPrimary(records);
    const secondary = records.find((record) => record !== primary);
    const flipped = primary.indicator === "A";
    const home = flipped ? primary.opponentSlug : primary.sourceSchool;
    const away = flipped ? primary.sourceSchool : primary.opponentSlug;

    // A result can reach one school's site before the other's.
    const scored = [primary, secondary]
      .filter((record): record is Resolved => Boolean(record))
      .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])[0];
    const status =
      STATUS_RANK[scored.status] >= STATUS_RANK.live ? scored.status : primary.status;

    // Scores are stored from each record's own point of view.
    const scoredIsHome = scored.sourceSchool === home;
    const pick = <T,>(own: T, other: T): [T, T] => (scoredIsHome ? [own, other] : [other, own]);
    const [homeScore, awayScore] = pick(scored.teamScore, scored.opponentScore);
    const [homePens, awayPens] = pick(scored.teamPens, scored.opponentPens);

    const date = primary.timeTbd && secondary && !secondary.timeTbd ? secondary.date : primary.date;
    const location = cleanText(primary.location);
    const named = location && !/^(home|tba|tbd)$/i.test(location) ? location : "";
    // At a neutral site nobody is playing at their own ground, and "home" is
    // only whichever record we read first -- so the feed's location is the
    // venue. Naming the home side's stadium there put a Wheaton ground in
    // Colorado, which the match page's venue-time row makes plain to see.
    const venue = (primary.indicator === "N" ? "" : resolver.venueFor(home)) || named;

    // Only worth storing when the ground is not the home side's own: a neutral
    // site, or an opponent whose own zone we may never have placed. Null means
    // "read the home team's zone", which is right for every member's ground.
    const timezone =
      primary.indicator === "N" || !resolver.isConference(home)
        ? (zoneForLocation(named) ?? resolver.zoneFor(home))
        : null;

    const bothConference = resolver.isConference(home) && resolver.isConference(away);
    const kind = records.some((record) => record.kind === "cciw")
      ? "cciw"
      : records.some((record) => record.kind === "ncaa")
        ? "ncaa"
        : "regular";

    matches.push({
      // The id's day is the CONFERENCE's day, deliberately. It is embedded in
      // every /matches/<id> URL and in bracket_slots.match_id, so it must never
      // follow a reader's zone.
      id: `${centralDay(date)}-${home}-${away}`,
      season: SEASON,
      date,
      status,
      home_slug: home,
      away_slug: away,
      home_placeholder: null,
      away_placeholder: null,
      home_score: status === "final" || status === "live" ? homeScore : null,
      away_score: status === "final" || status === "live" ? awayScore : null,
      home_pens: homePens,
      away_pens: awayPens,
      venue,
      timezone,
      time_tbd: primary.timeTbd && (!secondary || secondary.timeTbd),
      is_conference: kind === "regular" && bothConference,
      stage: kind === "ncaa" ? "ncaa" : "regular",
      bracket_slot: null,
      video_url: primary.videoUrl ?? secondary?.videoUrl ?? null,
      boxscore_url: scored.boxscoreUrl ?? primary.boxscoreUrl ?? secondary?.boxscoreUrl ?? null,
      recap_url: primary.recapUrl ?? secondary?.recapUrl ?? null,
      source_school: primary.sourceSchool,
      source_game_id: primary.gameId,
      cciw: kind === "cciw" && bothConference,
    });
  }

  matches.sort((a, b) => a.date.localeCompare(b.date));
  return { matches, placeholders };
}
