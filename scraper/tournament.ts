import { computeStandings } from "@/lib/standings";
import type { BracketSlotId } from "@/lib/types";
import { SEASON } from "./config";
import type { MatchRecord } from "./merge";
import { centralDay, centralToUtc } from "./normalize";
import type { RawGame, RawRound } from "./sidearm/schedule";

/**
 * Fits the CCIW tournament into its six-team bracket:
 *
 *   QF1  #3 v #6 ─┐
 *                 ├─ SF2  #2 v W(QF1) ─┐
 *   QF2  #4 v #5 ─┐                    ├─ Final
 *                 └─ SF1  #1 v W(QF2) ─┘
 *
 * Real games replace placeholders as soon as a school's feed names both teams.
 * Until then each slot gets a TBC match so the fixture list shows it.
 */

export type SlotRow = {
  season: number;
  slot: BracketSlotId;
  round: RawRound;
  home_seed: number | null;
  away_seed: number | null;
  home_from: BracketSlotId | null;
  away_from: BracketSlotId | null;
  match_id: string | null;
};

export type SeedRow = { season: number; seed: number; team_slug: string; is_official: boolean };

const ROUNDS: RawRound[] = ["quarterfinal", "semifinal", "final"];

function winnerOf(match: MatchRecord | undefined): string | null {
  if (!match || match.status !== "final" || match.home_score === null || match.away_score === null) {
    return null;
  }
  if (match.home_score !== match.away_score) {
    return match.home_score > match.away_score ? match.home_slug : match.away_slug;
  }
  if (match.home_pens !== null && match.away_pens !== null && match.home_pens !== match.away_pens) {
    return match.home_pens > match.away_pens ? match.home_slug : match.away_slug;
  }
  return null;
}

/** Day → round, learned from the placeholders the schools publish. */
function roundCalendar(placeholders: RawGame[], real: MatchRecord[]): Map<string, RawRound> {
  const calendar = new Map<string, RawRound>();
  for (const game of placeholders) {
    if (game.placeholderRound) calendar.set(centralDay(game.date), game.placeholderRound);
  }
  // Without placeholders, fall back to date order: first day QF, and so on.
  const days = [...new Set(real.map((match) => centralDay(match.date)))].sort();
  days.forEach((day, index) => {
    if (!calendar.has(day)) calendar.set(day, ROUNDS[Math.min(index, 2)]);
  });
  return calendar;
}

/**
 * With both real quarterfinals known, the seeds follow: QF hosts are #3/#4,
 * their guests #6/#5, and the two bye teams are #1/#2. Table order breaks
 * the ties inside each pair.
 */
function inferSeeds(quarterfinals: MatchRecord[], order: string[], field: string[]): Record<number, string> | null {
  if (quarterfinals.length !== 2) return null;
  const rank = (slug: string | null) => (slug ? order.indexOf(slug) : 99);
  const hosts = quarterfinals
    .map((match) => ({ host: match.home_slug, guest: match.away_slug }))
    .sort((a, b) => rank(a.host) - rank(b.host));
  const playing = new Set(quarterfinals.flatMap((match) => [match.home_slug, match.away_slug]));
  const byes = field.filter((slug) => !playing.has(slug)).sort((a, b) => rank(a) - rank(b));
  if (byes.length !== 2 || hosts.some((pair) => !pair.host || !pair.guest)) return null;

  return {
    1: byes[0],
    2: byes[1],
    3: hosts[0].host as string,
    4: hosts[1].host as string,
    5: hosts[1].guest as string,
    6: hosts[0].guest as string,
  };
}

export function buildBracket(input: {
  matches: MatchRecord[];
  placeholders: RawGame[];
  slots: SlotRow[];
  officialSeeds: Record<number, string> | null;
  conferenceSlugs: string[];
  nameOf: (slug: string) => string;
}): { matches: MatchRecord[]; seeds: SeedRow[]; slots: SlotRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const real = input.matches.filter((match) => match.cciw);
  const others = input.matches.filter((match) => !match.cciw);
  const calendar = roundCalendar(input.placeholders, real);
  for (const match of real) match.round = calendar.get(centralDay(match.date)) ?? "quarterfinal";

  const table = computeStandings(
    others.map((match) => ({
      status: match.status,
      isConference: match.is_conference,
      home: { teamSlug: match.home_slug, score: match.home_score },
      away: { teamSlug: match.away_slug, score: match.away_score },
    })),
    input.conferenceSlugs,
    input.nameOf,
  );
  const order = table.map((row) => row.teamSlug);
  const conferencePlayed = others.some((match) => match.is_conference && match.status === "final");

  // Seeds: official (set by hand) > inferred from real QFs > projected table.
  let seeds: Record<number, string> = {};
  let official = false;
  const quarterfinals = real.filter((match) => match.round === "quarterfinal");
  const inferred = inferSeeds(quarterfinals, order, order.slice(0, 6));
  if (input.officialSeeds && Object.keys(input.officialSeeds).length === 6) {
    seeds = input.officialSeeds;
    official = true;
  } else if (inferred) {
    seeds = inferred;
    official = true;
  } else if (conferencePlayed) {
    order.slice(0, 6).forEach((slug, index) => (seeds[index + 1] = slug));
  }

  const bySlot = new Map<BracketSlotId, MatchRecord>();
  const used = new Set<string>();
  const slots = [...input.slots].sort(
    (a, b) => ROUNDS.indexOf(a.round) - ROUNDS.indexOf(b.round) || a.slot.localeCompare(b.slot),
  );

  const roundDate = (round: RawRound): string | null => {
    const day = [...calendar.entries()].find(([, value]) => value === round)?.[0];
    // Noon, not midnight: with no kickoff published this is only a day anchor,
    // and noon still reads as the right day in every reader's zone.
    return day ? centralToUtc(`${day}T12:00:00`) : null;
  };

  const placeholderMatches: MatchRecord[] = [];
  const seedOf = (slug: string | null) =>
    Number(Object.entries(seeds).find(([, value]) => value === slug)?.[0] ?? 99);

  for (const slot of slots) {
    const side = (seed: number | null, from: BracketSlotId | null) => {
      if (seed) return { slug: seeds[seed] ?? null, label: `#${seed} seed` };
      if (from) return { slug: winnerOf(bySlot.get(from)), label: `Winner ${from.toUpperCase()}` };
      return { slug: null, label: "TBC" };
    };
    let home = side(slot.home_seed, slot.home_from);
    let away = side(slot.away_seed, slot.away_from);
    // The better seed hosts once both sides are known.
    if (home.slug && away.slug && seedOf(away.slug) < seedOf(home.slug)) [home, away] = [away, home];

    const known = [home.slug, away.slug].filter(Boolean) as string[];
    const found = real.find(
      (match) =>
        !used.has(match.id) &&
        match.round === slot.round &&
        known.length > 0 &&
        known.every((slug) => slug === match.home_slug || slug === match.away_slug),
    );

    if (found) {
      used.add(found.id);
      found.stage = slot.round;
      found.bracket_slot = slot.slot;
      bySlot.set(slot.slot, found);
      slot.match_id = found.id;
      continue;
    }

    const date = roundDate(slot.round);
    if (!date) {
      slot.match_id = null;
      continue;
    }
    const placeholder: MatchRecord = {
      id: `cciw-${SEASON}-${slot.slot}`,
      season: SEASON,
      date,
      status: "scheduled",
      home_slug: home.slug,
      away_slug: away.slug,
      home_placeholder: home.slug ? null : home.label,
      away_placeholder: away.slug ? null : away.label,
      home_score: null,
      away_score: null,
      home_pens: null,
      away_pens: null,
      venue: "",
      timezone: null,
      time_tbd: true,
      is_conference: false,
      stage: slot.round,
      bracket_slot: slot.slot,
      video_url: null,
      boxscore_url: null,
      recap_url: null,
      source_school: home.slug ?? input.conferenceSlugs[0],
      source_game_id: 0,
    };
    placeholderMatches.push(placeholder);
    bySlot.set(slot.slot, placeholder);
    slot.match_id = placeholder.id;
  }

  for (const match of real) {
    if (!used.has(match.id)) {
      match.stage = match.round ?? "quarterfinal";
      warnings.push(
        `CCIW tournament game ${match.id} does not fit the ${official ? "" : "projected "}bracket; ` +
          "set the official seeds in bracket_seeds if this persists.",
      );
    }
  }

  return {
    matches: [...others, ...real, ...placeholderMatches].sort((a, b) => a.date.localeCompare(b.date)),
    seeds: Object.entries(seeds).map(([seed, slug]) => ({
      season: SEASON,
      seed: Number(seed),
      team_slug: slug,
      is_official: official,
    })),
    slots,
    warnings,
  };
}
