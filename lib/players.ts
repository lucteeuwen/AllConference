import { resultFor } from "@/lib/selectors";
import type { Match, Player, PlayerGame, PlayerProfile, RecordLine } from "@/lib/types";

/**
 * Player pages, and tying the names in box scores back to roster players.
 * Box scores only carry a name (the scraper links some rows to an id, but not
 * those scraped before the roster was), so names are matched on read.
 */

export function playerHref(player: Pick<Player, "id">): string {
  return `/players/${player.id}`;
}

/** The same folding as the scraper's `slugify`, which builds player ids from names. */
export function nameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The roster player a box-score name on `teamSlug` refers to, if we know them. */
export type PlayerLookup = (teamSlug: string | null | undefined, name: string | null | undefined) => Player | null;

export function playerLookup(players: Player[]): PlayerLookup {
  const byName = new Map<string, Player>();
  // Box scores sometimes shorten or drop a name ("Alex" for "Alexander",
  // one surname of two), so a surname plus first initial is the fallback,
  // used only when it points at exactly one player on the team.
  const byInitial = new Map<string, Player | null>();
  const initialKey = (teamSlug: string, key: string) => {
    const parts = key.split("-");
    return parts.length < 2 ? null : `${teamSlug}|${parts[0][0]}|${parts[parts.length - 1]}`;
  };

  for (const player of players) {
    const key = nameKey(player.name);
    byName.set(`${player.teamSlug}|${key}`, player);
    const loose = initialKey(player.teamSlug, key);
    if (loose) byInitial.set(loose, byInitial.has(loose) ? null : player);
  }

  const find = (teamSlug: string, name: string) => {
    const key = nameKey(name);
    if (!key) return null;
    const exact = byName.get(`${teamSlug}|${key}`);
    if (exact) return exact;
    const loose = initialKey(teamSlug, key);
    return (loose && byInitial.get(loose)) || null;
  };

  return (teamSlug, name) => {
    if (!teamSlug || !name) return null;
    // Some box scores print "Belcher, Carson".
    const flipped = name.match(/^([^,]+),\s*([^,]+)$/);
    return find(teamSlug, name) ?? (flipped ? find(teamSlug, `${flipped[2]} ${flipped[1]}`) : null);
  };
}

/** A box score credits a shared assist as "Carson Belcher , Noah Cameron". */
export function splitAssists(assistName: string): string[] {
  return assistName
    .split(/\s+,\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export type LineupRecord = {
  match_id: string;
  team_slug: string | null;
  starter: boolean;
  position: string | null;
  player_name: string;
  player_id: string | null;
};

export type EventRecord = {
  match_id: string;
  minute: number;
  type: string;
  team_slug: string | null;
  player_name: string;
  player_id: string | null;
  assist_name: string | null;
  assist_player_id: string | null;
};

/** Every game the player's name shows up in a box score for, oldest first. */
export function buildGameLog(
  player: Player,
  matches: Match[],
  lineups: LineupRecord[],
  events: EventRecord[],
  lookup: PlayerLookup,
): PlayerGame[] {
  const isPlayer = (id: string | null, team: string | null, name: string | null) =>
    id === player.id || (team === player.teamSlug && lookup(team, name)?.id === player.id);

  const games = new Map<string, PlayerGame>();
  const gameFor = (matchId: string) => {
    let game = games.get(matchId);
    if (!game) {
      const match = matches.find((candidate) => candidate.id === matchId);
      if (!match) return null;
      game = { match, started: null, position: null, goals: 0, penalties: 0, assists: 0, yellow: 0, red: 0, goalMinutes: [] };
      games.set(matchId, game);
    }
    return game;
  };

  for (const row of lineups) {
    if (!isPlayer(row.player_id, row.team_slug, row.player_name)) continue;
    const game = gameFor(row.match_id);
    if (!game) continue;
    game.started = row.starter;
    game.position = row.position;
  }

  for (const event of events) {
    if (event.type !== "own-goal" && isPlayer(event.player_id, event.team_slug, event.player_name)) {
      const game = gameFor(event.match_id);
      if (!game) continue;
      if (event.type === "goal" || event.type === "penalty") {
        game.goals += 1;
        game.goalMinutes.push(event.minute);
        if (event.type === "penalty") game.penalties += 1;
      } else if (event.type === "yellow") game.yellow += 1;
      else if (event.type === "red") game.red += 1;
    }
    const assisted =
      event.assist_player_id === player.id ||
      splitAssists(event.assist_name ?? "").some((name) => isPlayer(null, event.team_slug, name));
    if (assisted) {
      const game = gameFor(event.match_id);
      if (game) game.assists += 1;
    }
  }

  return [...games.values()].sort((a, b) => a.match.date.localeCompare(b.match.date));
}

/** 1 for the best, shared by players level on the stat ("T-3" territory). */
export function rankOf(value: number, all: number[]): { rank: number; tied: boolean } {
  return {
    rank: all.filter((other) => other > value).length + 1,
    tied: all.filter((other) => other === value).length > 1,
  };
}

export type PlayerSummary = {
  points: number;
  goalsPerGame: number | null;
  minutesPerGoal: number | null;
  shotAccuracy: number | null;
  conversion: number | null;
  teamGoalShare: number | null;
  /** Among conference players, only when the player has at least one. */
  conferenceRank: { goals: { rank: number; tied: boolean } | null; assists: { rank: number; tied: boolean } | null };
  teamRank: { goals: { rank: number; tied: boolean } | null; assists: { rank: number; tied: boolean } | null };
  /** The team's W-D-L in the games the player started, from the box scores. */
  startedRecord: Pick<RecordLine, "w" | "d" | "l"> | null;
  multiGoalGames: number;
  firstGoal: PlayerGame | null;
  latest: PlayerGame | null;
  keeper: { gaa: number | null; savePct: number | null } | null;
};

export function summarize(
  player: Player,
  profile: PlayerProfile | null,
  games: PlayerGame[],
  conferencePlayers: Player[],
  teamGoalsFor: number | null,
): PlayerSummary {
  const { goals, assists, gp } = player.stats;
  const teammates = conferencePlayers.filter((other) => other.teamSlug === player.teamSlug);
  const rankIn = (pool: Player[], stat: "goals" | "assists") =>
    player.stats[stat] > 0 ? rankOf(player.stats[stat], pool.map((other) => other.stats[stat])) : null;

  const started = games.filter((game) => game.started === true);
  const results = started.map((game) => resultFor(game.match, player.teamSlug)).filter(Boolean);
  const keeper = profile?.keeper;

  return {
    points: goals * 2 + assists,
    goalsPerGame: gp > 0 ? goals / gp : null,
    minutesPerGoal: profile?.minutes && goals > 0 ? profile.minutes / goals : null,
    shotAccuracy: profile?.shots ? (profile.shotsOnGoal ?? 0) / profile.shots : null,
    conversion: profile?.shots ? goals / profile.shots : null,
    teamGoalShare: teamGoalsFor ? goals / teamGoalsFor : null,
    conferenceRank: { goals: rankIn(conferencePlayers, "goals"), assists: rankIn(conferencePlayers, "assists") },
    teamRank: { goals: rankIn(teammates, "goals"), assists: rankIn(teammates, "assists") },
    startedRecord:
      results.length > 0
        ? {
            w: results.filter((r) => r === "W").length,
            d: results.filter((r) => r === "D").length,
            l: results.filter((r) => r === "L").length,
          }
        : null,
    multiGoalGames: games.filter((game) => game.goals >= 2).length,
    firstGoal: games.find((game) => game.goals > 0) ?? null,
    latest: games.at(-1) ?? null,
    keeper: keeper
      ? {
          gaa: keeper.minutes > 0 ? (keeper.goalsAgainst * 90) / keeper.minutes : null,
          savePct: keeper.saves + keeper.goalsAgainst > 0 ? keeper.saves / (keeper.saves + keeper.goalsAgainst) : null,
        }
      : null,
  };
}
