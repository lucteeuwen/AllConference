import "./env";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FULL_EVERY_MS, LIVE, LIVESTATS, SEASON, SEASON_START, SPORT_SOURCES } from "./config";
import { createDb, must, upsertInChunks } from "./db";
import { fetchJson, fetchText, requestsMade, unreachableHosts } from "./http";
import { cacheLogo, pickLogoSource } from "./logos";
import { PHOTO_BUCKET, resolvePhoto, storedPhotoPath, type StoredPhoto } from "./photos";
import { parseNationalPoll } from "./rankings";
import { mergeGames, TeamResolver, type MatchRecord, type TeamRow } from "./merge";
import { slugify } from "./normalize";
import { becomesActive, estimatedFinish, isActive, keepAhead, LIVE_COLUMNS, livePatch, type LiveRow } from "./live";
import { parseBoxScore, type BoxSide } from "./sidearm/boxscore";
import { parseRoster, parseStats, rosterUrl, statsUrl } from "./sidearm/roster";
import { applyLiveStats, LiveStatsReader } from "./sidearm/livestats";
import { parseScoreboard, scoreboardUrl, type RawGame, type SidearmGame } from "./sidearm/schedule";
import { isSplitZoneState } from "./timezones";
import { startFromEvent } from "@/lib/live";
import { idPrefix, SPORTS, type Sport } from "@/lib/sport";
import { buildBracket, type SlotRow } from "./tournament";
import { resolveWatchLinks, type WatchSource } from "./watch";

/**
 * npm run scrape [-- --rosters] [--refresh-logos] [--dry-run] [--live] [--json] [--auto | --live-only]
 *
 *  1. Read every CCIW school's SIDEARM schedule feed and merge the two views
 *     of each conference game into one match. Men's soccer, then women's: each
 *     sport is its own pass over steps 1-3, in the same run.
 *  2. Fit the CCIW tournament into the bracket (TBC where undecided).
 *  3. Pull box scores for newly finished games, rosters and stats when asked,
 *     and logos and player photos when a school's URL for one changes.
 *  4. With `--live` only: while a match is on (15 min before kickoff until it
 *     ends), poll just its host's SIDEARM Stats feed every minute, writing
 *     only the columns a game changes, for up to 28 minutes -- staying on
 *     while a match is about to start. Never the schools' own sites, which
 *     don't update a game while it is played (see LIVE in ./config).
 *
 * `--auto` is what the workflow runs every 30 minutes: a full pass if the last
 * one is more than 20 minutes old, otherwise nothing (or live mode, with
 * `--live`). `--live-only` skips the full pass and exits within seconds if
 * nothing is on or about to be.
 * `--refresh-logos` uploads every logo again, even when its source is unchanged.
 */

const args = new Set(process.argv.slice(2));
const options = {
  dryRun: args.has("--dry-run"),
  rosters: args.has("--rosters"),
  refreshLogos: args.has("--refresh-logos"),
  // `--no-live` is still accepted, and is now what happens anyway.
  live: args.has("--live") && !args.has("--no-live"),
  json: args.has("--json"),
  auto: args.has("--auto"),
  liveOnly: args.has("--live-only"),
};

type ExistingMatch = {
  id: string;
  status: string;
  finished_at: string | null;
  events_scraped: boolean;
  /** Not loaded in live-only runs, which never write them. */
  home_score?: number | null;
  away_score?: number | null;
  /** Not loaded in live-only runs, which never write it. */
  broadcast_url?: string | null;
};

type Context = {
  db: SupabaseClient;
  sport: Sport;
  teams: TeamRow[];
  conference: TeamRow[];
  raws: Map<string, RawGame[]>;
  failedFeeds: Set<string>;
  existing: Map<string, ExistingMatch>;
  playerIds: Set<string>;
  matches: MatchRecord[];
  liveStats: LiveStatsReader;
  /** Each match's live stats link, from a full pass or a member's feed read once in live mode. */
  statsUrls: Map<string, string | null>;
  /** Members whose feed live mode has read this run for those links. */
  statsLookups: Set<string>;
  log: string[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Tagged with the sport, since one run's log holds both passes. */
function note(ctx: Context, message: string) {
  const line = `[${ctx.sport}] ${message}`;
  ctx.log.push(line);
  console.log(line);
}

function playerId(sport: Sport, team: string, name: string): string {
  return `${idPrefix(sport)}${SEASON}-${team}-${slugify(name)}`;
}

/** Every school, with what it is in this sport (SIDEARM id, national rank) from `team_sports`. */
async function loadTeams(db: SupabaseClient, sport: Sport): Promise<TeamRow[]> {
  const [teams, perSport] = await Promise.all([
    must<Omit<TeamRow, "sidearm_sport_id" | "national_rank">[]>(
      db
        .from("teams")
        .select(
          "slug, name, full_name, abbr, location, venue, timezone, is_conference, sidearm_base_url, aliases, logo_url, logo_source_url",
        ),
      "load teams",
    ),
    must<{ team_slug: string; sidearm_sport_id: number | null; national_rank: number | null }[]>(
      db.from("team_sports").select("team_slug, sidearm_sport_id, national_rank").eq("sport", sport),
      "load team sports",
    ),
  ]);
  const bySlug = new Map(perSport.map((row) => [row.team_slug, row]));
  return teams.map((team) => ({
    ...team,
    sidearm_sport_id: bySlug.get(team.slug)?.sidearm_sport_id ?? null,
    national_rank: bySlug.get(team.slug)?.national_rank ?? null,
  }));
}

/** SIDEARM numbers sports per site; read it once from the schedule page. */
async function ensureSportId(ctx: Context, team: TeamRow): Promise<number | null> {
  if (team.sidearm_sport_id) return team.sidearm_sport_id;
  const html = await fetchText(`${team.sidearm_base_url}/sports/${SPORT_SOURCES[ctx.sport].path}/schedule`);
  const match = html.match(/data-sport-id="(\d+)"/);
  if (!match) return null;
  team.sidearm_sport_id = Number(match[1]);
  if (!options.dryRun) {
    await must(
      ctx.db
        .from("team_sports")
        .upsert(
          { team_slug: team.slug, sport: ctx.sport, sidearm_sport_id: team.sidearm_sport_id },
          { onConflict: "team_slug,sport" },
        ),
      "save sport id",
    );
  }
  return team.sidearm_sport_id;
}

async function refreshFeeds(ctx: Context, schools: TeamRow[]): Promise<void> {
  await Promise.all(
    schools.map(async (team) => {
      try {
        const sportId = await ensureSportId(ctx, team);
        if (!sportId || !team.sidearm_base_url) throw new Error("no sport id");
        const feed = await fetchJson<SidearmGame[]>(scoreboardUrl(team.sidearm_base_url, sportId));
        ctx.raws.set(team.slug, parseScoreboard(feed, team.slug, team.sidearm_base_url, SEASON_START));
        ctx.failedFeeds.delete(team.slug);
      } catch (error) {
        ctx.failedFeeds.add(team.slug);
        note(ctx, `WARN feed ${team.slug}: ${(error as Error).message}`);
      }
    }),
  );
}

/**
 * Links each game to its own stream or replay (see ./watch). A game whose
 * platform could not be asked this run keeps the link it had.
 */
async function attachWatchLinks(ctx: Context): Promise<void> {
  const teams = ctx.teams.map((team) => ({
    slug: team.slug,
    name: team.name,
    fullName: team.full_name,
    aliases: team.is_conference ? team.aliases : [],
  }));
  const matches = ctx.matches.map((match) => ({
    ...match,
    broadcast_url: ctx.existing.get(match.id)?.broadcast_url ?? null,
  }));
  const results = await resolveWatchLinks(matches, { teams, sport: ctx.sport, log: (message) => note(ctx, message) });

  const counts = new Map<WatchSource | "none" | "kept", number>();
  const count = (key: WatchSource | "none" | "kept") => counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const match of ctx.matches) {
    const result = results.get(match.id);
    if (!result?.settled) {
      match.broadcast_url = ctx.existing.get(match.id)?.broadcast_url ?? null;
      count("kept");
      continue;
    }
    match.broadcast_url = result.url;
    count(result.source ?? "none");
    // A game a CCIW school hosts should be on its own network.
    const host = ctx.conference.some((team) => team.slug === match.home_slug);
    if (!result.url && host && match.status !== "final" && match.status !== "canceled") {
      note(ctx, `${match.id}: no stream found (yet): ${result.reason}`);
    }
  }
  note(ctx, `watch links: ${[...counts].map(([key, value]) => `${key} ${value}`).join(", ")} of ${ctx.matches.length} games`);
}

async function syncMatches(ctx: Context): Promise<void> {
  const resolver = new TeamResolver(ctx.teams);
  const { matches, placeholders } = mergeGames([...ctx.raws.values()].flat(), resolver, ctx.sport);

  // New non-conference opponents.
  const newTeams = [...resolver.created.values()].filter(
    (team) => !ctx.teams.some((known) => known.slug === team.slug),
  );
  // A state with counties in two zones that we could not place by city gets the
  // state's dominant zone, which may be wrong. Surface it so scraper/timezones.ts
  // grows from real fixtures rather than guesses.
  for (const team of newTeams) {
    if (team.location && isSplitZoneState(team.location)) {
      note(ctx, `WARN ${team.slug}: "${team.location}" is a split-zone state, assumed ${team.timezone}`);
    }
  }
  if (newTeams.length && !options.dryRun) {
    await must(
      ctx.db.from("teams").upsert(
        newTeams.map((team) => ({
          slug: team.slug,
          name: team.name,
          full_name: team.full_name,
          abbr: team.abbr,
          location: team.location,
          timezone: team.timezone,
          is_conference: false,
        })),
        { onConflict: "slug", ignoreDuplicates: true },
      ),
      "insert opponents",
    );
  }
  for (const team of newTeams) {
    ctx.teams.push({
      ...team,
      venue: "",
      sidearm_base_url: null,
      sidearm_sport_id: null,
      aliases: [],
      logo_url: null,
      logo_source_url: null,
      national_rank: null,
    });
  }

  // Bracket.
  const slots = await must<SlotRow[]>(
    ctx.db.from("bracket_slots").select("*").eq("sport", ctx.sport).eq("season", SEASON),
    "load slots",
  );
  const seedRows = await must<{ seed: number; team_slug: string; is_official: boolean }[]>(
    ctx.db.from("bracket_seeds").select("seed, team_slug, is_official").eq("sport", ctx.sport).eq("season", SEASON),
    "load seeds",
  );
  const official = seedRows.filter((row) => row.is_official);
  const bracket = buildBracket({
    matches,
    placeholders,
    slots,
    officialSeeds:
      official.length === 6 ? Object.fromEntries(official.map((row) => [row.seed, row.team_slug])) : null,
    conferenceSlugs: ctx.conference.map((team) => team.slug),
    nameOf: (slug) => ctx.teams.find((team) => team.slug === slug)?.name ?? slug,
    sport: ctx.sport,
  });
  bracket.warnings.forEach((warning) => note(ctx, `WARN ${warning}`));

  const now = new Date().toISOString();
  ctx.matches = bracket.matches;
  await attachWatchLinks(ctx);

  if (options.dryRun) return;

  const rows = bracket.matches.map((match) => {
    // Drop the in-memory helpers that have no column.
    const before = ctx.existing.get(match.id);
    const row = keepAhead({ ...match }, before);
    delete row.cciw;
    delete row.round;
    delete row.stats_url;
    let finishedAt = before?.finished_at ?? null;
    if (row.status === "final" && !finishedAt) {
      // Seen going final just now, unless the result was posted long after
      // the game (or this is the first import): then estimate full time.
      const estimate = estimatedFinish(match.date);
      const recent = Date.now() < Date.parse(estimate) + 60 * 60_000;
      finishedAt = before && before.status !== "final" && recent ? now : estimate;
    }
    if (row.status !== "final") finishedAt = null;
    return { ...row, finished_at: finishedAt, updated_at: now };
  });
  await upsertInChunks(ctx.db, "matches", rows, "id");

  // Drop matches that vanished from the feeds (moved date, removed game),
  // but only when every feed answered, so a flaky site cannot wipe its games.
  if (ctx.failedFeeds.size === 0) {
    const keep = new Set(rows.map((row) => row.id));
    const stale = [...ctx.existing.keys()].filter((id) => !keep.has(id));
    if (stale.length) {
      await must(ctx.db.from("matches").delete().in("id", stale), "delete stale matches");
      stale.forEach((id) => ctx.existing.delete(id));
      note(ctx, `removed ${stale.length} stale matches`);
    }
  }

  for (const row of rows) {
    const before = ctx.existing.get(row.id);
    ctx.existing.set(row.id, {
      id: row.id,
      status: row.status,
      finished_at: row.finished_at,
      events_scraped: before?.events_scraped ?? false,
      broadcast_url: row.broadcast_url,
    });
  }

  await upsertInChunks(ctx.db, "bracket_slots", bracket.slots, "sport,season,slot");
  if (official.length !== 6) {
    await must(
      ctx.db.from("bracket_seeds").delete().eq("sport", ctx.sport).eq("season", SEASON),
      "clear projected seeds",
    );
    if (bracket.seeds.length) await upsertInChunks(ctx.db, "bracket_seeds", bracket.seeds, "sport,season,seed");
  }

  await syncLogos(ctx, resolver.logoSources);
  await syncRankings(ctx);
}

/** Stores each team's place in the national poll, and clears teams that dropped out. */
async function syncRankings(ctx: Context): Promise<void> {
  try {
    const poll = parseNationalPoll(await fetchText(SPORT_SOURCES[ctx.sport].pollUrl));
    // An empty poll means the page changed, not that nobody is ranked.
    if (poll.length === 0) {
      note(ctx, "WARN national poll had no rows, keeping stored ranks");
      return;
    }

    const bySchool = new Map(poll.map((entry) => [entry.school.toLowerCase(), entry.rank]));
    for (const team of ctx.teams) {
      const names = [team.full_name, ...(team.is_conference ? [team.name, ...team.aliases] : [])];
      const rank = names.map((name) => bySchool.get(name.toLowerCase())).find((value) => value !== undefined) ?? null;
      if (rank === (team.national_rank ?? null)) continue;
      await must(
        ctx.db
          .from("team_sports")
          .upsert({ team_slug: team.slug, sport: ctx.sport, national_rank: rank }, { onConflict: "team_slug,sport" }),
        "save rank",
      );
      team.national_rank = rank;
    }
    note(ctx, `national poll: ${poll.length} ranked`);
  } catch (error) {
    note(ctx, `WARN national poll: ${(error as Error).message}`);
  }
}

async function syncLogos(ctx: Context, sources: Map<string, Set<string>>): Promise<void> {
  for (const [slug, candidates] of sources) {
    const team = ctx.teams.find((row) => row.slug === slug);
    const source = pickLogoSource(team?.logo_source_url ?? null, candidates);
    if (!team || !source) continue;
    if (team.logo_source_url === source && team.logo_url && !options.refreshLogos) continue;
    try {
      const url = await cacheLogo(ctx.db, slug, source);
      await must(
        ctx.db.from("teams").update({ logo_url: url, logo_source_url: source }).eq("slug", slug),
        "save logo",
      );
      team.logo_url = url;
      team.logo_source_url = source;
    } catch (error) {
      note(ctx, `WARN logo ${slug}: ${(error as Error).message}`);
    }
  }
}

/**
 * `only` limits it to those matches (live mode). `anchor` lets a goal seen for
 * the first time re-anchor the match's start time, which is only sound when the
 * poll is close behind the goal, so live mode alone sets it.
 */
async function syncBoxScores(ctx: Context, limit = 80, only?: Set<string>, anchor = false): Promise<void> {
  const due = ctx.matches.filter((match) => {
    if (only && !only.has(match.id)) return false;
    if (!match.boxscore_url || !match.home_slug || !match.away_slug) return false;
    if (match.status === "live") return true;
    return match.status === "final" && !ctx.existing.get(match.id)?.events_scraped;
  });

  for (const match of due.slice(0, limit)) {
    try {
      const box = parseBoxScore(await fetchText(match.boxscore_url as string));

      // The template lists visitors first; if the totals say otherwise, trust them.
      const swapped =
        box.totals.home !== null &&
        match.home_score !== match.away_score &&
        box.totals.home === match.away_score &&
        box.totals.away === match.home_score;
      const slugFor = (side: BoxSide | null) => {
        if (!side) return null;
        const real = swapped ? (side === "home" ? "away" : "home") : side;
        return real === "home" ? match.home_slug : match.away_slug;
      };
      const knownPlayer = (team: string | null, name: string) => {
        if (!team) return null;
        const id = playerId(ctx.sport, team, name);
        return ctx.playerIds.has(id) ? id : null;
      };

      const events = box.events.map((event, index) => {
        const team = slugFor(event.side);
        return {
          match_id: match.id,
          sort: index,
          minute: event.minute,
          type: event.type,
          team_slug: team,
          player_name: event.playerName,
          player_id: event.type === "own-goal" ? null : knownPlayer(team, event.playerName),
          assist_name: event.assistName ?? null,
          assist_player_id: event.assistName ? knownPlayer(team, event.assistName) : null,
        };
      });
      const lineups = box.lineups.map((entry, index) => {
        const team = slugFor(entry.side);
        const side = team === match.home_slug ? "home" : "away";
        return {
          match_id: match.id,
          team_slug: team,
          side,
          sort: index,
          starter: entry.starter,
          number: entry.number,
          player_name: entry.name,
          position: entry.position,
          player_id: knownPlayer(team, entry.name),
        };
      });

      // Compared before the rewrite: a later minute than any stored is a goal
      // or card we have only just seen.
      let startedAt: string | null = null;
      if (anchor && match.status === "live") {
        const prior = await must<{ minute: number }[]>(
          ctx.db.from("match_events").select("minute").eq("match_id", match.id),
          "prior events",
        );
        const latest = Math.max(0, ...box.events.map((event) => event.minute));
        const known = Math.max(0, ...prior.map((row) => row.minute));
        if (latest > known) startedAt = startFromEvent(latest, Date.now(), match.date, LIVE.pollMs / 2);
      }

      await must(ctx.db.from("match_events").delete().eq("match_id", match.id), "clear events");
      await must(ctx.db.from("match_lineups").delete().eq("match_id", match.id), "clear lineups");
      if (events.length) await must(ctx.db.from("match_events").insert(events), "insert events");
      if (lineups.length) await must(ctx.db.from("match_lineups").insert(lineups), "insert lineups");

      const done = match.status === "final";
      await must(
        ctx.db
          .from("matches")
          .update({
            attendance: box.attendance,
            referee: box.referee,
            ...(box.stadium ? { venue: box.stadium } : {}),
            ...(startedAt ? { started_at: startedAt } : {}),
            events_scraped: done,
          })
          .eq("id", match.id),
        "save box score",
      );
      const existing = ctx.existing.get(match.id);
      if (existing) existing.events_scraped = done;
    } catch (error) {
      note(ctx, `WARN box score ${match.id}: ${(error as Error).message}`);
    }
  }
  if (due.length > limit) note(ctx, `${due.length - limit} box scores left for the next run`);
}

/**
 * Some rosters leave a player's position blank (Wheaton does). Every box
 * score lineup already carries a position (GK/DEF/MID/FWD) regardless of
 * that, so this fills the gap from whichever game recorded it first —
 * including games scraped in an earlier run, since a school's own roster
 * page can be down for a while.
 */
async function backfillPositions(ctx: Context): Promise<void> {
  const missing = await must<{ id: string }[]>(
    ctx.db.from("players").select("id").eq("sport", ctx.sport).eq("season", SEASON).is("position", null),
    "load players missing position",
  );
  if (missing.length === 0) return;
  const missingIds = new Set(missing.map((row) => row.id));

  const lineups = await must<{ player_id: string | null; position: string | null }[]>(
    ctx.db
      .from("match_lineups")
      .select("player_id, position")
      .not("player_id", "is", null)
      .not("position", "is", null),
    "load lineup positions",
  );

  const found = new Map<string, string>();
  for (const row of lineups) {
    if (row.player_id && row.position && missingIds.has(row.player_id)) {
      found.set(row.player_id, row.position);
    }
  }
  if (found.size === 0) return;

  await Promise.all(
    [...found].map(([id, position]) => must(ctx.db.from("players").update({ position }).eq("id", id), "backfill player position")),
  );
  note(ctx, `backfilled position for ${found.size} players from box-score lineups`);
}

async function syncRosters(ctx: Context): Promise<void> {
  for (const team of ctx.conference) {
    if (!team.sidearm_base_url) continue;
    try {
      const [rosterHtml, statsHtml] = await Promise.all([
        fetchText(rosterUrl(team.sidearm_base_url, SEASON, SPORT_SOURCES[ctx.sport].path)),
        fetchText(statsUrl(team.sidearm_base_url, SEASON, SPORT_SOURCES[ctx.sport].path)).catch(() => ""),
      ]);
      const roster = parseRoster(rosterHtml);
      if (roster.length === 0) {
        note(ctx, `WARN roster ${team.slug}: no players found, keeping the stored roster`);
        continue;
      }
      const stats = statsHtml ? parseStats(statsHtml) : [];
      const now = new Date().toISOString();
      const base = team.sidearm_base_url;
      const absolute = (path: string | null) => (path ? new URL(path, base).href : null);

      const stored = await must<(StoredPhoto & { id: string })[]>(
        ctx.db
          .from("players")
          .select("id, photo_url, photo_source_url")
          .eq("sport", ctx.sport)
          .eq("season", SEASON)
          .eq("team_slug", team.slug),
        "load players",
      );
      const storedById = new Map(stored.map((row) => [row.id, row]));
      const photos = new Map<string, StoredPhoto>();
      for (const player of roster) {
        const id = playerId(ctx.sport, team.slug, player.name);
        photos.set(
          id,
          await resolvePhoto(ctx.db, id, absolute(player.photoPath), storedById.get(id), {
            download: !options.dryRun,
            onWarning: (message) => note(ctx, message),
          }),
        );
      }

      const rows = roster.map((player) => {
        const id = playerId(ctx.sport, team.slug, player.name);
        const line =
          stats.find((stat) => player.sidearmId !== null && stat.sidearmId === player.sidearmId) ??
          stats.find((stat) => stat.name.toLowerCase() === player.name.toLowerCase());
        return {
          id,
          sport: ctx.sport,
          season: SEASON,
          team_slug: team.slug,
          sidearm_id: player.sidearmId,
          number: player.number,
          name: player.name,
          position: player.position ?? (line?.goalkeeper ? "GK" : null),
          year: player.year,
          hometown: player.hometown,
          height: player.height,
          gp: line?.gp ?? 0,
          gs: line?.gs ?? 0,
          goals: line?.goals ?? 0,
          assists: line?.assists ?? 0,
          ...photos.get(id),
          bio_url: absolute(player.bioPath),
          position_long: player.positionLong || null,
          weight: player.weight || null,
          high_school: player.highSchool || null,
          previous_school: player.previousSchool || null,
          major: player.major || null,
          captain: player.captain,
          minutes: line?.minutes ?? null,
          shots: line?.shots ?? null,
          shots_on_goal: line?.shotsOnGoal ?? null,
          game_winners: line?.gameWinners ?? null,
          pk_goals: line?.pkGoals ?? null,
          pk_attempts: line?.pkAttempts ?? null,
          yellow_cards: line?.yellow ?? null,
          red_cards: line?.red ?? null,
          gk_minutes: line?.keeper?.minutes ?? null,
          goals_against: line?.keeper?.goalsAgainst ?? null,
          saves: line?.keeper?.saves ?? null,
          gk_wins: line?.keeper?.wins ?? null,
          gk_losses: line?.keeper?.losses ?? null,
          gk_ties: line?.keeper?.ties ?? null,
          shutouts: line?.keeper?.shutouts ?? null,
          updated_at: now,
        };
      });
      // Two roster rows with the same name would collide on the id.
      const unique = [...new Map(rows.map((row) => [row.id, row])).values()];

      if (!options.dryRun) {
        await upsertInChunks(ctx.db, "players", unique, "id");
        const ids = unique.map((row) => row.id);
        const goneRows = stored.filter((row) => !ids.includes(row.id));
        if (goneRows.length) {
          await must(ctx.db.from("players").delete().in("id", goneRows.map((row) => row.id)), "delete players");
          const files = goneRows.map((row) => storedPhotoPath(row.photo_url)).filter((path) => path !== null);
          if (files.length) {
            const { error } = await ctx.db.storage.from(PHOTO_BUCKET).remove(files);
            if (error) note(ctx, `WARN photos ${team.slug}: could not remove ${files.length} files: ${error.message}`);
          }
        }
      }
      unique.forEach((row) => ctx.playerIds.add(row.id));
      note(ctx, `roster ${team.slug}: ${unique.length} players, ${stats.length} stat lines`);
    } catch (error) {
      note(ctx, `WARN roster ${team.slug}: ${(error as Error).message}`);
    }
  }
}

/**
 * Stored matches around now: the ones on (`active`), and whether one more comes
 * on before `until`, so a run should wait for it rather than end.
 */
async function loadLive(ctx: Context, until: number, now = Date.now()): Promise<{ active: LiveRow[]; waiting: boolean }> {
  const rows = await must<LiveRow[]>(
    ctx.db
      .from("matches")
      .select(LIVE_COLUMNS)
      .eq("sport", ctx.sport)
      .eq("season", SEASON)
      .eq("time_tbd", false)
      .gte("date", new Date(now - LIVE.tailMs).toISOString())
      .lte("date", new Date(Math.max(now, until) + LIVE.leadMs).toISOString()),
    "load active matches",
  );
  return {
    active: rows.filter((row) => isActive(row, now)),
    waiting: rows.some((row) => becomesActive(row, now, until)),
  };
}

/**
 * The live stats link of a match a member plays away at a non-member, whose
 * folder we cannot know in advance. Taken from the last full pass, else from
 * that member's scoreboard feed, read at most once per run.
 */
async function statsUrlOf(ctx: Context, row: LiveRow): Promise<string | null> {
  if (row.home_slug && LIVESTATS.folders[row.home_slug]) return null;
  if (ctx.statsUrls.has(row.id)) return ctx.statsUrls.get(row.id) ?? null;
  const member = ctx.conference.find((team) => team.slug === row.away_slug);
  if (member && !ctx.statsLookups.has(member.slug)) {
    ctx.statsLookups.add(member.slug);
    await refreshFeeds(ctx, [member]);
    const { matches } = mergeGames(ctx.raws.get(member.slug) ?? [], new TeamResolver(ctx.teams), ctx.sport);
    for (const match of matches) ctx.statsUrls.set(match.id, match.stats_url ?? null);
  }
  if (!ctx.statsUrls.has(row.id)) ctx.statsUrls.set(row.id, null);
  return ctx.statsUrls.get(row.id) ?? null;
}

/**
 * One live poll. Reads only the active matches' live stats feeds, then writes
 * only what changed on those matches. Returns whether any feed answered, or
 * true when none had a feed to read.
 */
async function pollLive(ctx: Context, active: LiveRow[]): Promise<boolean> {
  const resolver = new TeamResolver(ctx.teams);
  const folders = new Map<string, string[]>();
  for (const row of active) {
    const stats_url = await statsUrlOf(ctx, row);
    folders.set(row.id, await ctx.liveStats.foldersFor({ home_slug: row.home_slug, stats_url }));
  }
  const stats = await ctx.liveStats.read([...folders.values()].flat());

  const now = Date.now();
  for (const row of active) {
    let record: LiveRow | null = null;
    for (const folder of folders.get(row.id) ?? []) {
      const feed = stats.get(folder);
      record = feed ? applyLiveStats(row, feed, resolver) : null;
      if (record) break;
    }
    const patch = record && livePatch(row, record, now);
    if (!patch) continue;
    await must(
      ctx.db
        .from("matches")
        .update({ ...patch, updated_at: new Date(now).toISOString() })
        .eq("id", row.id),
      "live update",
    );
    const status = patch.status ?? row.status;
    const home = patch.home_score ?? row.home_score;
    const away = patch.away_score ?? row.away_score;
    note(ctx, `live ${row.id}: ${status} ${home ?? "-"}-${away ?? "-"}`);
  }

  return stats.size === 0 || [...stats.values()].some(Boolean);
}

/**
 * Polls each sport's active matches once a minute until the run's time is up,
 * or none is on and none is about to start. `immediate` skips the first wait,
 * for a run that has not just read the feeds itself. Returns false only if no
 * feed answered on any poll.
 */
async function liveLoop(ctxs: Context[], startedAt: number, immediate: boolean): Promise<boolean> {
  const deadline = startedAt + LIVE.budgetMs;
  let polls = 0;
  let answered = false;
  const announced = new Set<string>();

  // A full pass just read the links; live mode need not look them up again.
  for (const ctx of ctxs) {
    for (const match of ctx.matches) ctx.statsUrls.set(match.id, match.stats_url ?? null);
  }

  if (!immediate) {
    if (Date.now() + LIVE.pollMs >= deadline) return true;
    await sleep(LIVE.pollMs);
  }
  for (;;) {
    // A doubleheader has both sports on at once.
    const states = await Promise.all(ctxs.map((ctx) => loadLive(ctx, deadline)));
    if (states.every((state) => state.active.length === 0 && !state.waiting)) break;
    for (const [index, ctx] of ctxs.entries()) {
      const { active } = states[index];
      if (active.length === 0) continue;
      const fresh = active.filter((row) => !announced.has(row.id));
      if (fresh.length) note(ctx, `live mode: ${fresh.map((row) => row.id).join(", ")}`);
      fresh.forEach((row) => announced.add(row.id));
      if (await pollLive(ctx, active)) answered = true;
      polls++;
    }
    if (Date.now() + LIVE.pollMs >= deadline) break;
    await sleep(LIVE.pollMs);
  }
  if (polls) console.log(`live mode: ${polls} polls`);
  return polls === 0 || answered;
}

/** True when the last successful full pass is older than `FULL_EVERY_MS`. */
async function needsFullPass(db: SupabaseClient): Promise<boolean> {
  const last = await must<{ started_at: string }[]>(
    db
      .from("scrape_runs")
      .select("started_at")
      .like("mode", "full%")
      .eq("ok", true)
      .order("id", { ascending: false })
      .limit(1),
    "last full run",
  );
  return !last[0] || Date.now() - Date.parse(last[0].started_at) > FULL_EVERY_MS;
}

async function finishRun(db: SupabaseClient, runId: number | null, ok: boolean, log: string[]) {
  if (runId === null) return;
  await db.from("scrape_runs").update({ finished_at: new Date().toISOString(), ok, log }).eq("id", runId);
}

async function loadPlayerIds(ctx: Context): Promise<number> {
  const players = await must<{ id: string }[]>(
    ctx.db.from("players").select("id").eq("sport", ctx.sport).eq("season", SEASON),
    "load player ids",
  );
  players.forEach((row) => ctx.playerIds.add(row.id));
  return players.length;
}

/** Live mode on its own: exits within seconds when nothing is on or about to be. */
async function runLiveOnly(db: SupabaseClient, ctxs: Context[], log: string[], startedAt: number): Promise<void> {
  const states = await Promise.all(ctxs.map((ctx) => loadLive(ctx, startedAt + LIVE.budgetMs)));
  if (states.every((state) => state.active.length === 0 && !state.waiting)) {
    console.log("no active matches");
    return;
  }
  const run = await must<{ id: number }>(
    db.from("scrape_runs").insert({ mode: "live" }).select("id").single(),
    "start run",
  );
  let ok = false;
  try {
    ok = await liveLoop(ctxs, startedAt, true);
  } finally {
    log.push(`done in ${Math.round((Date.now() - startedAt) / 1000)}s, ${requestsMade()} requests`);
    await finishRun(db, run.id, ok, log);
  }
  if (!ok) process.exitCode = 1;
}

/** One sport's full pass. Returns whether any of its schools' feeds answered. */
async function fullPass(ctx: Context): Promise<boolean> {
  // A dry run reads them too, so it shows which stored links a run would keep.
  const existing = await must<ExistingMatch[]>(
    ctx.db
      .from("matches")
      .select("id, status, finished_at, events_scraped, broadcast_url, home_score, away_score")
      .eq("sport", ctx.sport)
      .eq("season", SEASON),
    "load matches",
  );
  existing.forEach((row) => ctx.existing.set(row.id, row));
  const players = await loadPlayerIds(ctx);

  // Schedules first: they matter most, and a failing roster page should not
  // mark a site as down before its feed has been tried.
  await refreshFeeds(ctx, ctx.conference);
  // With no feed at all there is nothing to merge: the bracket would be rebuilt
  // from an empty season, which clears its projected seeds and empties the
  // tournament slots until the sites come back.
  if (ctx.failedFeeds.size < ctx.conference.length) await syncMatches(ctx);
  else note(ctx, "WARN no school feed answered, keeping the stored matches and bracket");
  // Rosters before box scores, so lineups can link to player ids.
  if (options.rosters || players === 0) await syncRosters(ctx);

  if (options.dryRun) {
    report(ctx);
  } else {
    await syncBoxScores(ctx);
    await backfillPositions(ctx);
  }
  // A few schools being down is normal; the pass only fails if none answered.
  const ok = ctx.failedFeeds.size < ctx.conference.length;
  if (ok && ctx.failedFeeds.size) note(ctx, `partial run: no feed from ${[...ctx.failedFeeds].join(", ")}`);
  return ok;
}

async function main() {
  const startedAt = Date.now();
  const db = createDb(options.dryRun);
  const log: string[] = [];

  const contextFor = async (sport: Sport): Promise<Context> => {
    const teams = await loadTeams(db, sport);
    const conference = teams.filter((team) => team.is_conference && team.sidearm_base_url);
    if (conference.length === 0) throw new Error("No conference teams in the database. Run the migrations first.");
    const ctx: Context = {
      db,
      sport,
      teams,
      conference,
      raws: new Map(),
      failedFeeds: new Set(),
      existing: new Map(),
      playerIds: new Set(),
      matches: [],
      liveStats: new LiveStatsReader(sport, (message) => note(ctx, message)),
      statsUrls: new Map(),
      statsLookups: new Set(),
      log,
    };
    return ctx;
  };

  const notDue = !options.dryRun && options.auto && !options.rosters && !(await needsFullPass(db));
  if (notDue && !options.live && !options.liveOnly) {
    console.log("full pass not due");
    return;
  }
  if (!options.dryRun && (options.liveOnly || notDue)) {
    return runLiveOnly(db, await Promise.all(SPORTS.map(contextFor)), log, startedAt);
  }

  let runId: number | null = null;
  if (!options.dryRun) {
    const run = await must<{ id: number }>(
      db.from("scrape_runs").insert({ mode: options.rosters ? "full+rosters" : "full" }).select("id").single(),
      "start run",
    );
    runId = run.id;
  }

  let ok = false;
  try {
    const ctxs: Context[] = [];
    let feedsOk = true;
    for (const sport of SPORTS) {
      // Read per sport, after the previous pass: it may have added opponents.
      const ctx = await contextFor(sport);
      ctxs.push(ctx);
      if (!(await fullPass(ctx))) feedsOk = false;
    }

    let liveOk = true;
    // The feeds were just read, so wait a poll before reading them again.
    if (!options.dryRun && options.live && feedsOk) liveOk = await liveLoop(ctxs, startedAt, false);
    ok = feedsOk && liveOk;
  } finally {
    const down = unreachableHosts();
    const tail = [
      ...(down.length ? [`WARN unreachable this run: ${down.join(", ")}`] : []),
      `done in ${Math.round((Date.now() - startedAt) / 1000)}s, ${requestsMade()} requests`,
    ];
    tail.forEach((line) => console.log(line));
    log.push(...tail);
    await finishRun(db, runId, ok, log);
  }
  if (!ok) process.exitCode = 1;
}

function report(ctx: Context) {
  const byStage = new Map<string, number>();
  for (const match of ctx.matches) byStage.set(match.stage, (byStage.get(match.stage) ?? 0) + 1);
  console.log(`\n[${ctx.sport}] ${ctx.matches.length} matches:`, Object.fromEntries(byStage));
  console.log(`conference: ${ctx.matches.filter((match) => match.is_conference).length}`);
  console.log(`final: ${ctx.matches.filter((match) => match.status === "final").length}`);
  console.log(`with video: ${ctx.matches.filter((match) => match.video_url).length}`);
  console.log(`with a stream link: ${ctx.matches.filter((match) => match.broadcast_url).length}`);
  const tbc = ctx.matches.filter((match) => !match.home_slug || !match.away_slug);
  console.log(`TBC: ${tbc.map((match) => `${match.id} (${match.home_placeholder ?? match.home_slug} v ${match.away_placeholder ?? match.away_slug})`).join(", ")}`);
  if (options.json) console.log(JSON.stringify(ctx.matches, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
