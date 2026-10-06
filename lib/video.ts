import type { MatchVideo, Team } from "@/lib/types";

/**
 * Turns the free-form "video" link a school puts on a game into something the
 * match page can show, and says whether it goes to this game's own broadcast
 * (`exact`) or only to a team or channel page. Only a specific YouTube video can
 * be embedded: Hudl TV networks and FloCollege are subscription players.
 */

const YOUTUBE_ID = /^[\w-]{11}$/;

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;

  const fromQuery = url.searchParams.get("v");
  if (fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery;

  const [kind, id] = url.pathname.split("/").filter(Boolean);
  if (["live", "embed", "shorts"].includes(kind) && id && YOUTUBE_ID.test(id)) return id;
  return null;
}

const NETWORKS: Record<string, string> = {
  "cciwnetwork.com": "CCIW Network",
  "wiacnetwork.com": "WIAC Network",
  "miaasportsnetwork.com": "MIAA Sports Network",
  "miacsportsnetwork.com": "MIAC Sports Network",
  "rollriversnetwork.com": "Rolling Rivers Network",
  "centraldutchnetwork.com": "Central Dutch Network",
  "watchmidwestsports.com": "Midwest Sports Network",
  "boxcast.tv": "BoxCast",
  "espn.com": "ESPN",
  "flocollege.com": "FloCollege",
  "flosports.link": "FloCollege",
  "youtube.com": "YouTube",
  "hudl.com": "Hudl",
};

function platformName(host: string): string {
  for (const [domain, name] of Object.entries(NETWORKS)) {
    if (host === domain || host.endsWith(`.${domain}`)) return name;
  }
  return host;
}

/** `?B=<id>` on a Hudl TV network, or a vCloud broadcast page. */
function hudlBroadcastId(url: URL): string | null {
  const fromQuery = url.searchParams.get("B");
  if (fromQuery && /^\d+$/.test(fromQuery)) return fromQuery;
  return url.hostname.endsWith("vcloud.hudl.com") ? (url.pathname.match(/\/broadcast\/(?:embed\/)?(\d+)/)?.[1] ?? null) : null;
}

/** FloCollege "sign up to watch" links wrap the real page in tracking parameters. */
function unwrapFlo(url: URL): URL {
  if (!url.hostname.endsWith("flocollege.com") || url.pathname !== "/signup") return url;
  const target = url.searchParams.get("redirect");
  return target?.startsWith("/") ? new URL(`https://www.flocollege.com${target}`) : url;
}

export function classifyVideo(raw: string | null | undefined): MatchVideo | undefined {
  if (!raw) return undefined;

  let url: URL;
  try {
    url = unwrapFlo(new URL(raw.trim()));
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;

  const host = url.hostname.replace(/^www\./, "");
  const href = url.toString();
  const platform = platformName(host);

  const id = youtubeId(url);
  if (id) {
    return {
      url: href,
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      label: "Watch on YouTube",
      exact: true,
      platform,
    };
  }

  const broadcastId = hudlBroadcastId(url);
  if (broadcastId) {
    return { url: href, provider: "hudl", label: `Watch on ${platform}`, exact: true, platform, broadcastId };
  }

  const flo = host.includes("flocollege") || host === "flosports.link";
  const floGame = /^\/(live\/\d+|events\/)/.test(url.pathname) || host === "flosports.link";
  if (flo && floGame) {
    return { url: href, provider: "flo", label: "Watch on FloCollege", exact: true, platform };
  }

  // A stream page for one piece of content, not a team or channel listing.
  if (host === "rsn.rockfordregents.com" && url.pathname.startsWith("/content/")) {
    return { url: href, provider: "other", label: `Watch on ${platform}`, exact: true, platform };
  }

  const provider: MatchVideo["provider"] = host.endsWith("youtube.com")
    ? "youtube"
    : flo
      ? "flo"
      : host.endsWith("network.com") || host.endsWith("hudl.com")
        ? "hudl"
        : "other";
  return { url: href, provider, label: `Find the game on ${platform}`, exact: false, platform };
}

/* ------------------------------------------------------------------------ */
/* Checking a broadcast's title against the game it is linked from          */
/* ------------------------------------------------------------------------ */

/**
 * Lower case, punctuation gone, and without the words schools add or leave out
 * at will, so "Concordia University Chicago" reads as "Concordia Chicago" and
 * "University of Dubuque" as "Dubuque".
 */
function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, " ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\buw\b/g, "wisconsin")
    .replace(/\b(university|college|colleges|of|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** Short forms titles use that no name of the team spells out. */
const EXTRA_ALIASES: Record<string, string[]> = {
  "milwaukee-school-of-engineering": ["MSOE"],
  "concordia-chicago": ["CUC", "Concordia-Chicago"],
  "concordia-wis": ["Concordia Wisconsin", "CUW"],
  "california-institute-of-technology": ["Caltech"],
  "claremont-mudd-scripps-colleges": ["CMS"],
  "university-of-chicago": ["UChicago"],
  washu: ["Wash U", "WUSTL"],
  "washington-in-st-louis": ["WashU", "Wash U", "WUSTL"],
  "illinois-institute-of-technology": ["Illinois Tech", "IIT"],
  "north-central": ["NCC"],
  "illinois-wesleyan": ["IWU"],
};

/** Spellings a title may use for a team: "Dubuque" for "University of Dubuque". */
function aliasesOf(team: NamedTeam): string[] {
  const out = new Set<string>();
  for (const name of [team.name, team.fullName, ...(team.aliases ?? []), ...(EXTRA_ALIASES[team.slug] ?? [])]) {
    out.add(normalize(name).trim());
  }
  out.delete("");
  return [...out];
}

/** A team as titles are checked against it; `aliases` are other spellings of its name. */
export type NamedTeam = Pick<Team, "slug" | "name" | "fullName"> & { aliases?: string[] };

/** Teams the database holds under two slugs. */
const SAME_TEAM: string[][] = [["washu", "washington-in-st-louis"]];

export type TitleVerdict = "match" | "mismatch" | "unknown";

/** The slugs a game's sides answer to, counting a team the database holds twice. */
function ownSlugs(playing: string[]): Set<string> {
  const own = new Set(playing);
  for (const group of SAME_TEAM) if (group.some((slug) => own.has(slug))) group.forEach((slug) => own.add(slug));
  return own;
}

/** A bracket stand-in ("Semifinals", "CCIW 1st Round"), not a school. */
export function isStandIn(slug: string): boolean {
  return /^cciw-|^(quarterfinals|semifinals|finals)$/.test(slug);
}

/** The teams a title names, one set of slugs per name found (a name may fit two schools). */
function titleMentions(title: string, teams: NamedTeam[]): Set<string>[] {
  const byAlias = new Map<string, Set<string>>();
  for (const team of teams) {
    if (isStandIn(team.slug)) continue;
    for (const alias of aliasesOf(team)) {
      if (!byAlias.has(alias)) byAlias.set(alias, new Set());
      byAlias.get(alias)?.add(team.slug);
    }
  }

  // Longest names first, each match blanked out: "Illinois Wesleyan" must not
  // also read as "Illinois".
  let rest = normalize(title);
  const mentions: Set<string>[] = [];
  for (const alias of [...byAlias.keys()].sort((a, b) => b.length - a.length)) {
    const needle = ` ${alias} `;
    if (!rest.includes(needle)) continue;
    mentions.push(byAlias.get(alias) as Set<string>);
    rest = rest.split(needle).join(" ");
  }
  return mentions;
}

/**
 * Does a broadcast title read like this game? "mismatch" for a women's game or
 * a title that names a team that isn't playing; "unknown" when it names no team
 * we know (nothing to confirm it by).
 */
export function titleVerdict(title: string, playing: string[], teams: NamedTeam[]): TitleVerdict {
  if (/\bwomen'?s?\b|\bwomens\b/i.test(title.replace(/&#0?39;/g, "'"))) return "mismatch";

  const own = ownSlugs(playing);
  const mentions = titleMentions(title, teams);
  if (mentions.length === 0) return "unknown";
  const isOurs = (slugs: Set<string>) => [...slugs].some((slug) => own.has(slug));
  if (mentions.some((slugs) => !isOurs(slugs))) return "mismatch";
  return "match";
}

/**
 * A title that names both sides and no one else, so it is this game and not one
 * of the school's others. `implied` is a side the title may leave out because
 * the page it is on already says whose it is.
 */
export function titleNamesBoth(title: string, playing: string[], teams: NamedTeam[], implied?: string): boolean {
  if (titleVerdict(title, playing, teams) === "mismatch") return false;
  const mentions = titleMentions(title, teams);
  return playing.every((slug) => {
    if (slug === implied) return true;
    const own = ownSlugs([slug]);
    return mentions.some((slugs) => [...slugs].some((candidate) => own.has(candidate)));
  });
}
