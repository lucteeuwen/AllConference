import type { MatchStatus } from "@/lib/types";
import { CONFERENCE_TZ } from "../config";
import { cleanText, wallClockToUtc } from "../normalize";

/**
 * SIDEARM's scoreboard component feed:
 * `/services/adaptive_components.ashx?type=scoreboard&count=100&sport_id=<id>`.
 * It lists one school's whole season from that school's point of view.
 */

export type SidearmGame = {
  id: number;
  date: string;
  date_utc: string | null;
  tbd: boolean;
  status: string;
  location_indicator: "H" | "A" | "N" | string;
  location: string | null;
  is_conference: boolean;
  tournament: string | null;
  opponent: { id: number; name: string; image: string | null } | null;
  media: { video: string | null } | null;
  story: { url: string | null } | null;
  result: {
    status: string | null;
    team_score: string | null;
    opponent_score: string | null;
    prescore: string | null;
    postscore: string | null;
    boxscore: string | null;
  } | null;
};

export type RawRound = "quarterfinal" | "semifinal" | "final";

export type RawGame = {
  sourceSchool: string;
  sourceBaseUrl: string;
  gameId: number;
  /** UTC instant. With no time published this is noon at the source school, a
   * day anchor rather than a kickoff: far enough from either date boundary that
   * the day still reads correctly in every reader's zone. */
  date: string;
  timeTbd: boolean;
  status: MatchStatus;
  indicator: "H" | "A" | "N";
  opponentName: string;
  opponentImage: string | null;
  location: string;
  kind: "regular" | "cciw" | "ncaa";
  /** Only for CCIW placeholders ("CCIW Tournament Semifinal"). */
  placeholderRound: RawRound | null;
  teamScore: number | null;
  opponentScore: number | null;
  teamPens: number | null;
  opponentPens: number | null;
  boxscoreUrl: string | null;
  recapUrl: string | null;
  videoUrl: string | null;
};

export function scoreboardUrl(baseUrl: string, sportId: number): string {
  return `${baseUrl}/services/adaptive_components.ashx?type=scoreboard&count=100&sport_id=${sportId}`;
}

const CCIW_TOURNAMENT = /CCIW|College Conference of Illinois/i;
const PLACEHOLDER = /CCIW Tournament\s+(Quarterfinal|Semifinal|Championship|Final)/i;

function absolute(baseUrl: string, path: string | null | undefined): string | null {
  const clean = cleanText(path);
  if (!clean) return null;
  try {
    return new URL(clean, baseUrl).toString();
  } catch {
    return null;
  }
}

function score(value: string | null | undefined): number | null {
  const clean = cleanText(value);
  return /^\d+$/.test(clean) ? Number(clean) : null;
}

/** "(4-3 PK)", "W 1-1 (5-4 pens)", "4-3 in PKs" → [4, 3] from this team's view. */
export function parsePens(...texts: (string | null | undefined)[]): [number, number] | null {
  for (const text of texts) {
    const match = cleanText(text).match(/(\d+)\s*-\s*(\d+)\s*(?:in\s+)?(?:PKs?|pens?|penalt|SO\b|shootout)/i);
    if (match) return [Number(match[1]), Number(match[2])];
  }
  return null;
}

function mapStatus(game: SidearmGame): MatchStatus | "skip" {
  const result = game.result;
  const note = `${result?.prescore ?? ""} ${result?.postscore ?? ""}`;
  const hasScore = score(result?.team_score) !== null && score(result?.opponent_score) !== null;

  if (game.status === "C" || /cancel/i.test(note)) return "canceled";
  if (game.status === "P" || /postpone|ppd/i.test(note)) return "postponed";
  if (game.status === "O") {
    // "O" with no W/L/T is an exhibition or a game the school only hosted.
    return result && ["W", "L", "T"].includes(result.status ?? "") && hasScore ? "final" : "skip";
  }
  // "I" is in progress even before a goal; anything else counts once it has a score.
  return game.status === "I" || hasScore ? "live" : "scheduled";
}

/** Parses one school's feed. Returns only games that belong on the site. */
export function parseScoreboard(
  games: SidearmGame[],
  sourceSchool: string,
  sourceBaseUrl: string,
  seasonStart: string,
  /**
   * The zone this feed's naive `date` strings are written in. SIDEARM renders
   * them in the wall clock of the site being read, not of the venue, so this is
   * the source school's own zone -- Central for all nine members today.
   */
  sourceTz: string = CONFERENCE_TZ,
): RawGame[] {
  const out: RawGame[] = [];

  for (const game of games) {
    const opponentName = cleanText(game.opponent?.name);
    if (!opponentName) continue;
    if (game.date.slice(0, 10) < seasonStart) continue;
    // Other teams' games at a tournament this school hosts.
    if (/\svs\.?\s/i.test(opponentName)) continue;
    if (/exhibition|scrimmage/i.test(`${opponentName} ${game.tournament ?? ""}`)) continue;

    const status = mapStatus(game);
    if (status === "skip") continue;

    const tournament = cleanText(game.tournament);
    const placeholder = opponentName.match(PLACEHOLDER);
    const isCciw = CCIW_TOURNAMENT.test(tournament) || Boolean(placeholder);
    const isNcaa = !isCciw && /NCAA/i.test(`${tournament} ${opponentName}`);
    // NCAA placeholders ("NCAA Tournament" vs TBA) have nothing to show yet.
    if (isNcaa && /NCAA/i.test(opponentName)) continue;

    const round = placeholder?.[1].toLowerCase();
    const pens = parsePens(game.result?.postscore, game.result?.prescore);
    const indicator = ["H", "A", "N"].includes(game.location_indicator)
      ? (game.location_indicator as RawGame["indicator"])
      : "N";

    out.push({
      sourceSchool,
      sourceBaseUrl,
      gameId: game.id,
      date: game.date_utc
        ? new Date(game.date_utc.replace(/(\.\d{3})\d+/, "$1")).toISOString()
        : wallClockToUtc(`${game.date.slice(0, 10)}T12:00:00`, sourceTz),
      timeTbd: game.tbd || !game.date_utc,
      status,
      indicator,
      opponentName,
      opponentImage: absolute(sourceBaseUrl, game.opponent?.image),
      location: cleanText(game.location),
      kind: isCciw ? "cciw" : isNcaa ? "ncaa" : "regular",
      placeholderRound: placeholder
        ? round === "quarterfinal"
          ? "quarterfinal"
          : round === "semifinal"
            ? "semifinal"
            : "final"
        : null,
      teamScore: score(game.result?.team_score),
      opponentScore: score(game.result?.opponent_score),
      teamPens: pens?.[0] ?? null,
      opponentPens: pens?.[1] ?? null,
      boxscoreUrl: absolute(sourceBaseUrl, game.result?.boxscore),
      recapUrl: absolute(sourceBaseUrl, game.story?.url),
      videoUrl: absolute(sourceBaseUrl, game.media?.video),
    });
  }

  return out;
}
