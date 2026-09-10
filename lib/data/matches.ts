import { createRng } from "@/lib/rng";
import { allTeams, teams } from "@/lib/data/teams";
import { rosters } from "@/lib/data/rosters";
import { kickoff } from "@/lib/data/season";
import type { Match, MatchEvent, MatchStatus, Player } from "@/lib/types";

/**
 * A generated CCIW season: a single round robin among the nine conference
 * members plus a handful of non-conference fixtures. Rounds are placed relative
 * to today so the app always has finished results behind it, a live match now,
 * and fixtures ahead.
 */

const teamBySlug = Object.fromEntries(allTeams.map((team) => [team.slug, team]));

/** Circle-method round robin. The bye placeholder handles the odd team count. */
function roundRobin(slugs: string[]): [string, string][][] {
  const BYE = "__bye__";
  const wheel = slugs.length % 2 === 0 ? [...slugs] : [...slugs, BYE];
  const size = wheel.length;
  const rounds: [string, string][][] = [];

  for (let round = 0; round < size - 1; round++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < size / 2; i++) {
      const a = wheel[i];
      const b = wheel[size - 1 - i];
      if (a === BYE || b === BYE) continue;
      // Alternate hosting each round so home and away stay balanced.
      pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    wheel.splice(1, 0, wheel.pop() as string);
  }

  return rounds;
}

/**
 * Days from today for each of the nine conference rounds. Index 6 is today, so
 * the app always opens with six rounds of results behind it and two ahead.
 */
const ROUND_OFFSETS = [-16, -13, -10, -7, -4, -2, 0, 3, 7];
const KICKOFF_TIMES: [number, number][] = [
  [11, 0],
  [13, 0],
  [15, 30],
  [19, 0],
];

const GOAL_WEIGHTS = [0.22, 0.32, 0.26, 0.14, 0.06];

function drawGoals(random: number): number {
  let cumulative = 0;
  for (let goals = 0; goals < GOAL_WEIGHTS.length; goals++) {
    cumulative += GOAL_WEIGHTS[goals];
    if (random < cumulative) return goals;
  }
  return GOAL_WEIGHTS.length - 1;
}

const SCORING_WEIGHT: Record<Player["position"], number> = { F: 6, M: 3, D: 1, GK: 0 };

function pickScorer(squad: Player[], rng: ReturnType<typeof createRng>): Player {
  const pool = squad.flatMap((player) =>
    Array<Player>(SCORING_WEIGHT[player.position]).fill(player),
  );
  return rng.pick(pool);
}

function buildEvents(
  matchId: string,
  homeSlug: string,
  awaySlug: string,
  homeScore: number,
  awayScore: number,
): MatchEvent[] {
  const rng = createRng(`events:${matchId}`);
  const events: MatchEvent[] = [];

  for (const [slug, goals] of [
    [homeSlug, homeScore],
    [awaySlug, awayScore],
  ] as const) {
    const squad = rosters[slug];
    for (let i = 0; i < goals; i++) {
      const scorer = pickScorer(squad, rng);
      const assister = rng.chance(0.6)
        ? squad.find((player) => player.id !== scorer.id && player.position !== "GK")
        : undefined;
      events.push({
        minute: rng.int(2, 89),
        type: rng.chance(0.08) ? "penalty" : "goal",
        teamSlug: slug,
        playerId: scorer.id,
        assistPlayerId: assister?.id,
      });
    }

    for (let i = 0; i < rng.int(0, 2); i++) {
      events.push({
        minute: rng.int(15, 88),
        type: rng.chance(0.12) ? "red" : "yellow",
        teamSlug: slug,
        playerId: rng.pick(squad.filter((player) => player.position !== "GK")).id,
      });
    }
  }

  return events.sort((a, b) => a.minute - b.minute);
}

function buildLineup(slug: string, matchId: string) {
  const rng = createRng(`lineup:${matchId}:${slug}`);
  const squad = rosters[slug];
  const byPosition = (position: Player["position"]) =>
    rng.shuffle(squad.filter((player) => player.position === position));

  const starters = [
    ...byPosition("GK").slice(0, 1),
    ...byPosition("D").slice(0, 4),
    ...byPosition("M").slice(0, 4),
    ...byPosition("F").slice(0, 2),
  ].map((player) => player.id);

  const subs = squad
    .filter((player) => !starters.includes(player.id))
    .slice(0, 7)
    .map((player) => player.id);

  return { starters, subs };
}

const REFEREES = [
  "M. Delaney",
  "R. Okonkwo",
  "S. Vandermeer",
  "T. Halvorsen",
  "J. Castellanos",
  "P. Nowicki",
];

function buildMatch(
  id: string,
  date: string,
  homeSlug: string,
  awaySlug: string,
  status: MatchStatus,
  isConference: boolean,
): Match {
  const rng = createRng(`match:${id}`);
  const played = status === "final" || status === "live";

  // A live match is only part-way through, so it carries a lower score.
  const homeScore = played ? drawGoals(status === "live" ? rng.next() * 0.8 : rng.next()) : null;
  const awayScore = played ? drawGoals(status === "live" ? rng.next() * 0.8 : rng.next()) : null;

  const events =
    played && homeScore !== null && awayScore !== null
      ? buildEvents(id, homeSlug, awaySlug, homeScore, awayScore)
      : [];

  const liveMinute = status === "live" ? rng.int(28, 72) : undefined;

  return {
    id,
    date,
    status,
    minute: liveMinute,
    home: { teamSlug: homeSlug, score: homeScore },
    away: { teamSlug: awaySlug, score: awayScore },
    venue: teamBySlug[homeSlug].venue,
    isConference,
    attendance: status === "final" ? rng.int(240, 1450) : undefined,
    referee: rng.pick(REFEREES),
    events: status === "live" ? events.filter((event) => event.minute <= (liveMinute ?? 0)) : events,
    lineups: played
      ? { home: buildLineup(homeSlug, id), away: buildLineup(awaySlug, id) }
      : undefined,
  };
}

function buildConferenceMatches(): Match[] {
  const rounds = roundRobin(teams.map((team) => team.slug));
  const built: Match[] = [];

  rounds.forEach((pairs, roundIndex) => {
    const offset = ROUND_OFFSETS[roundIndex];
    const isToday = offset === 0;
    const isPast = offset < 0;

    pairs.forEach(([homeSlug, awaySlug], pairIndex) => {
      const [hour, minute] = KICKOFF_TIMES[pairIndex % KICKOFF_TIMES.length];
      const id = `cciw-r${roundIndex + 1}-${homeSlug}-${awaySlug}`;

      let status: MatchStatus = "scheduled";
      if (isToday) {
        // One result already in, one in progress, the rest still to come.
        status = pairIndex === 0 ? "final" : pairIndex === 1 ? "live" : "scheduled";
      } else if (isPast) {
        status = "final";
      } else if (roundIndex === 7 && pairIndex === 3) {
        // One postponement ahead of us, so the status has something to show.
        status = "postponed";
      }

      built.push(buildMatch(id, kickoff(offset, hour, minute), homeSlug, awaySlug, status, true));
    });
  });

  return built;
}

/** Non-conference games: mostly early-season, two late friendlies. */
const NON_CONFERENCE: [string, string, number, number][] = [
  ["north-central", "uw-whitewater", -26, 19],
  ["loras", "wheaton", -26, 15],
  ["carthage", "calvin", -23, 13],
  ["washu", "illinois-wesleyan", -23, 19],
  ["elmhurst", "loras", -21, 15],
  ["augustana", "calvin", -21, 13],
  ["north-park", "washu", -19, 19],
  ["millikin", "uw-whitewater", -19, 13],
  ["carroll", "calvin", 5, 19],
  ["wheaton", "washu", 10, 13],
];

function buildNonConferenceMatches(): Match[] {
  return NON_CONFERENCE.map(([homeSlug, awaySlug, offset, hour]) =>
    buildMatch(
      `nc-${homeSlug}-${awaySlug}-${offset}`,
      kickoff(offset, hour),
      homeSlug,
      awaySlug,
      offset < 0 ? "final" : "scheduled",
      false,
    ),
  );
}

export const matches: Match[] = [...buildConferenceMatches(), ...buildNonConferenceMatches()].sort(
  (a, b) => a.date.localeCompare(b.date),
);
