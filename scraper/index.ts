import "./env";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE, SEASON, SEASON_START } from "./config";
import { createDb, must, upsertInChunks } from "./db";
import { fetchJson, fetchText, requestsMade, unreachableHosts } from "./http";
import { cacheLogo } from "./logos";
import { mergeGames, TeamResolver, type MatchRecord, type TeamRow } from "./merge";
import { slugify } from "./normalize";
import { parseBoxScore, type BoxSide } from "./sidearm/boxscore";
import { parseRoster, parseStats, rosterUrl, statsUrl } from "./sidearm/roster";
import { parseScoreboard, scoreboardUrl, type RawGame, type SidearmGame } from "./sidearm/schedule";
import { buildBracket, type SlotRow } from "./tournament";

/**
 * npm run scrape [-- --rosters] [--dry-run] [--no-live] [--json]
 *
 *  1. Read every CCIW school's SIDEARM schedule feed and merge the two views
 *     of each conference game into one match.
 *  2. Fit the CCIW tournament into the bracket (TBC where undecided).
 *  3. Pull box scores for newly finished games, rosters and stats when asked,
 *     and logos when a school's logo URL changes.
 *  4. If a match is on (15 min before kickoff until it ends), keep polling the
 *     host schools every two minutes for up to 13 minutes.
 */

const args = new Set(process.argv.slice(2));
const options = {
  dryRun: args.has("--dry-run"),
  rosters: args.has("--rosters"),
  live: !args.has("--no-live"),
  json: args.has("--json"),
};

type ExistingMatch = {
  id: string;
  status: string;
  finished_at: string | null;
  events_scraped: boolean;
};

type Context = {
  db: SupabaseClient;
  teams: TeamRow[];
  conference: TeamRow[];
  raws: Map<string, RawGame[]>;
  failedFeeds: Set<string>;
  existing: Map<string, ExistingMatch>;
  playerIds: Set<string>;
  matches: MatchRecord[];
  log: string[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function note(ctx: Context, message: string) {
  ctx.log.push(message);
  console.log(message);
}

function playerId(team: string, name: string): string {
  return `${SEASON}-${team}-${slugify(name)}`;
}

async function loadTeams(db: SupabaseClient): Promise<TeamRow[]> {
  return must(
    db
      .from("teams")
      .select(
        "slug, name, full_name, abbr, venue, is_conference, sidearm_base_url, sidearm_sport_id, aliases, logo_url, logo_source_url",
      ),
    "load teams",
  );
}

/** SIDEARM numbers sports per site; read it once from the schedule page. */
async function ensureSportId(ctx: Context, team: TeamRow): Promise<number | null> {
  if (team.sidearm_sport_id) return team.sidearm_sport_id;
  const html = await fetchText(`${team.sidearm_base_url}/sports/mens-soccer/schedule`);
  const match = html.match(/data-sport-id="(\d+)"/);
  if (!match) return null;
  team.sidearm_sport_id = Number(match[1]);
  if (!options.dryRun) {
    await must(
      ctx.db.from("teams").update({ sidearm_sport_id: team.sidearm_sport_id }).eq("slug", team.slug),
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

/** Estimated full-time for matches we never saw finish. */
function estimatedFinish(date: string): string {
  return new Date(new Date(date).getTime() + 115 * 60_000).toISOString();
}

async function syncMatches(ctx: Context): Promise<void> {
  const resolver = new TeamResolver(ctx.teams);
  const { matches, placeholders } = mergeGames([...ctx.raws.values()].flat(), resolver);

  // New non-conference opponents.
  const newTeams = [...resolver.created.values()].filter(
    (team) => !ctx.teams.some((known) => known.slug === team.slug),
  );
  if (newTeams.length && !options.dryRun) {
    await must(
      ctx.db.from("teams").upsert(
        newTeams.map((team) => ({
          slug: team.slug,
          name: team.name,
          full_name: team.full_name,
          abbr: team.abbr,
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
    });
  }

  // Bracket.
  const slots = await must<SlotRow[]>(
    ctx.db.from("bracket_slots").select("*").eq("season", SEASON),
    "load slots",
  );
  const seedRows = await must<{ seed: number; team_slug: string; is_official: boolean }[]>(
    ctx.db.from("bracket_seeds").select("seed, team_slug, is_official").eq("season", SEASON),
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
  });
  bracket.warnings.forEach((warning) => note(ctx, `WARN ${warning}`));

  const now = new Date().toISOString();
  ctx.matches = bracket.matches;

  if (options.dryRun) return;

  const rows = bracket.matches.map((match) => {
    // Drop the in-memory helpers that have no column.
    const row = { ...match };
    delete row.cciw;
    delete row.round;
    delete row.timeTbd;
    const before = ctx.existing.get(match.id);
    let finishedAt = before?.finished_at ?? null;
    if (match.status === "final" && !finishedAt) {
      // Seen going final just now, unless the result was posted long after
      // the game (or this is the first import): then estimate full time.
      const estimate = estimatedFinish(match.date);
      const recent = Date.now() < Date.parse(estimate) + 60 * 60_000;
      finishedAt = before && before.status !== "final" && recent ? now : estimate;
    }
    if (match.status !== "final") finishedAt = null;
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
    });
  }

  await upsertInChunks(ctx.db, "bracket_slots", bracket.slots, "season,slot");
  if (official.length !== 6) {
    await must(
      ctx.db.from("bracket_seeds").delete().eq("season", SEASON),
      "clear projected seeds",
    );
    if (bracket.seeds.length) await upsertInChunks(ctx.db, "bracket_seeds", bracket.seeds, "season,seed");
  }

  await syncLogos(ctx, resolver.logoSources);
}

async function syncLogos(ctx: Context, sources: Map<string, string>): Promise<void> {
  for (const [slug, source] of sources) {
    const team = ctx.teams.find((row) => row.slug === slug);
    if (!team || (team.logo_source_url === source && team.logo_url)) continue;
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

async function syncBoxScores(ctx: Context, limit = 80): Promise<void> {
  const due = ctx.matches.filter((match) => {
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
        const id = playerId(team, name);
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
    ctx.db.from("players").select("id").eq("season", SEASON).is("position", null),
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
        fetchText(rosterUrl(team.sidearm_base_url, SEASON)),
        fetchText(statsUrl(team.sidearm_base_url, SEASON)).catch(() => ""),
      ]);
      const roster = parseRoster(rosterHtml);
      if (roster.length === 0) {
        note(ctx, `WARN roster ${team.slug}: no players found, keeping the stored roster`);
        continue;
      }
      const stats = statsHtml ? parseStats(statsHtml) : [];
      const now = new Date().toISOString();

      const rows = roster.map((player) => {
        const line =
          stats.find((stat) => player.sidearmId !== null && stat.sidearmId === player.sidearmId) ??
          stats.find((stat) => stat.name.toLowerCase() === player.name.toLowerCase());
        return {
          id: playerId(team.slug, player.name),
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
          updated_at: now,
        };
      });
      // Two roster rows with the same name would collide on the id.
      const unique = [...new Map(rows.map((row) => [row.id, row])).values()];

      if (!options.dryRun) {
        await upsertInChunks(ctx.db, "players", unique, "id");
        const ids = unique.map((row) => row.id);
        const stored = await must<{ id: string }[]>(
          ctx.db.from("players").select("id").eq("season", SEASON).eq("team_slug", team.slug),
          "load players",
        );
        const gone = stored.map((row) => row.id).filter((id) => !ids.includes(id));
        if (gone.length) await must(ctx.db.from("players").delete().in("id", gone), "delete players");
      }
      unique.forEach((row) => ctx.playerIds.add(row.id));
      note(ctx, `roster ${team.slug}: ${unique.length} players, ${stats.length} stat lines`);
    } catch (error) {
      note(ctx, `WARN roster ${team.slug}: ${(error as Error).message}`);
    }
  }
}

function activeMatches(ctx: Context, now = Date.now()): MatchRecord[] {
  return ctx.matches.filter((match) => {
    if (match.status === "live") return true;
    if (match.status !== "scheduled" || match.timeTbd) return false;
    const kickoff = new Date(match.date).getTime();
    return now >= kickoff - LIVE.leadMs && now <= kickoff + LIVE.tailMs;
  });
}

async function liveLoop(ctx: Context, startedAt: number): Promise<void> {
  const deadline = startedAt + LIVE.budgetMs;
  let polls = 0;
  while (Date.now() + LIVE.pollMs < deadline) {
    const active = activeMatches(ctx);
    if (active.length === 0) break;
    if (polls === 0) note(ctx, `live mode: ${active.map((match) => match.id).join(", ")}`);
    await sleep(LIVE.pollMs);
    const hosts = new Set(active.map((match) => match.source_school));
    await refreshFeeds(ctx, ctx.conference.filter((team) => hosts.has(team.slug)));
    await syncMatches(ctx);
    await syncBoxScores(ctx, 10);
    polls++;
  }
  if (polls) note(ctx, `live mode: ${polls} polls`);
}

async function main() {
  const startedAt = Date.now();
  const db = createDb(options.dryRun);
  const teams = await loadTeams(db);
  const conference = teams.filter((team) => team.is_conference && team.sidearm_base_url);
  if (conference.length === 0) throw new Error("No conference teams in the database. Run the migrations first.");

  const ctx: Context = {
    db,
    teams,
    conference,
    raws: new Map(),
    failedFeeds: new Set(),
    existing: new Map(),
    playerIds: new Set(),
    matches: [],
    log: [],
  };

  let runId: number | null = null;
  if (!options.dryRun) {
    const run = await must<{ id: number }>(
      db.from("scrape_runs").insert({ mode: options.rosters ? "full+rosters" : "full" }).select("id").single(),
      "start run",
    );
    runId = run.id;
    const existing = await must<ExistingMatch[]>(
      db.from("matches").select("id, status, finished_at, events_scraped").eq("season", SEASON),
      "load matches",
    );
    existing.forEach((row) => ctx.existing.set(row.id, row));
  }

  let ok = false;
  try {
    const players = await must<{ id: string }[]>(
      db.from("players").select("id").eq("season", SEASON),
      "load player ids",
    );
    players.forEach((row) => ctx.playerIds.add(row.id));

    // Schedules first: they matter most, and a failing roster page should not
    // mark a site as down before its feed has been tried.
    await refreshFeeds(ctx, conference);
    await syncMatches(ctx);
    // Rosters before box scores, so lineups can link to player ids.
    if (options.rosters || players.length === 0) await syncRosters(ctx);

    if (options.dryRun) {
      report(ctx);
    } else {
      await syncBoxScores(ctx);
      await backfillPositions(ctx);
      if (options.live) await liveLoop(ctx, startedAt);
    }
    // A few schools being down is normal; the run only fails if none answered.
    ok = ctx.failedFeeds.size < conference.length;
  } finally {
    const down = unreachableHosts();
    if (down.length) note(ctx, `WARN unreachable this run: ${down.join(", ")}`);
    note(ctx, `done in ${Math.round((Date.now() - startedAt) / 1000)}s, ${requestsMade()} requests`);
    if (runId !== null) {
      await db
        .from("scrape_runs")
        .update({ finished_at: new Date().toISOString(), ok, log: ctx.log })
        .eq("id", runId);
    }
  }
  if (!ok) process.exitCode = 1;
  else if (ctx.failedFeeds.size) note(ctx, `partial run: no feed from ${[...ctx.failedFeeds].join(", ")}`);
}

function report(ctx: Context) {
  const byStage = new Map<string, number>();
  for (const match of ctx.matches) byStage.set(match.stage, (byStage.get(match.stage) ?? 0) + 1);
  console.log(`\n${ctx.matches.length} matches:`, Object.fromEntries(byStage));
  console.log(`conference: ${ctx.matches.filter((match) => match.is_conference).length}`);
  console.log(`final: ${ctx.matches.filter((match) => match.status === "final").length}`);
  console.log(`with video: ${ctx.matches.filter((match) => match.video_url).length}`);
  const tbc = ctx.matches.filter((match) => !match.home_slug || !match.away_slug);
  console.log(`TBC: ${tbc.map((match) => `${match.id} (${match.home_placeholder ?? match.home_slug} v ${match.away_placeholder ?? match.away_slug})`).join(", ")}`);
  if (options.json) console.log(JSON.stringify(ctx.matches, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
