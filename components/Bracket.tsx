import Link from "next/link";
import { TeamBadge } from "@/components/TeamBadge";
import { winnerOf } from "@/components/broadcast/MatchRow";
import { formatKickoff, formatShortDate } from "@/lib/format";
import { TBC_TEAM } from "@/lib/teams";
import type { Bracket as BracketData, BracketSlot, BracketSlotId, Match, Team } from "@/lib/types";

/**
 * The six-team CCIW tournament. Quarterfinal 2 feeds semifinal 1 (the #1
 * seed's game) and quarterfinal 1 feeds semifinal 2, so the columns are
 * ordered to keep each feed next to the game it leads into.
 */

const COLUMNS: { title: string; slots: BracketSlotId[] }[] = [
  { title: "Quarterfinals", slots: ["qf2", "qf1"] },
  { title: "Semifinals", slots: ["sf1", "sf2"] },
  { title: "Final", slots: ["final"] },
];

type Line = {
  seed: number | null;
  team: Team;
  label: string;
  known: boolean;
  score: number | null;
  pens: number | null;
  won: boolean;
};

function seedFor(bracket: BracketData, slug: string | null): number | null {
  if (!slug) return null;
  const entry = Object.entries(bracket.seeds).find(([, value]) => value === slug);
  return entry ? Number(entry[0]) : null;
}

function linesFor(
  slot: BracketSlot,
  match: Match | undefined,
  bracket: BracketData,
  teams: Map<string, Team>,
): [Line, Line] {
  if (match) {
    const winner = winnerOf(match);
    return (["home", "away"] as const).map((side) => ({
      seed: seedFor(bracket, match[side].teamSlug),
      team: match[side].team,
      label: match[side].teamSlug ? match[side].team.name : (match[side].placeholder ?? "TBC"),
      known: Boolean(match[side].teamSlug),
      score: match[side].score,
      pens: match[side].pens ?? null,
      won: winner === side,
    })) as [Line, Line];
  }

  // No fixture yet (no date published): describe the slot itself.
  const describe = (seed: number | null, from: BracketSlotId | null): Line => {
    const slug = seed ? bracket.seeds[seed] : undefined;
    const team = slug ? teams.get(slug) : undefined;
    return {
      seed,
      team: team ?? TBC_TEAM,
      label: team ? team.name : seed ? `#${seed} seed` : `Winner ${from?.toUpperCase() ?? ""}`.trim(),
      known: Boolean(team),
      score: null,
      pens: null,
      won: false,
    };
  };
  return [describe(slot.homeSeed, slot.homeFrom), describe(slot.awaySeed, slot.awayFrom)];
}

function SlotCard({
  slot,
  match,
  bracket,
  teams,
}: {
  slot: BracketSlot;
  match: Match | undefined;
  bracket: BracketData;
  teams: Map<string, Team>;
}) {
  const lines = linesFor(slot, match, bracket, teams);
  const status = !match
    ? "Date TBA"
    : match.status === "final"
      ? "Full time"
      : match.status === "live"
        ? "Live"
        : `${formatShortDate(match.date)} · ${formatKickoff(match.date)}`;

  const body = (
    <>
      <p className="bc-label mb-2 flex items-center justify-between gap-2 text-[0.6rem] text-ink-faint">
        <span>{slot.slot === "final" ? "Championship" : slot.slot.toUpperCase()}</span>
        <span className={match?.status === "live" ? "text-live" : ""}>{status}</span>
      </p>
      {lines.map((line, index) => (
        <div key={index} className="flex items-center gap-2 py-1">
          <span className="w-5 shrink-0 text-right text-[0.65rem] font-bold text-ink-faint tabular-nums">
            {line.seed ?? ""}
          </span>
          <TeamBadge team={line.team} size="xs" />
          <span
            className={`min-w-0 flex-1 truncate text-[0.78rem] ${
              line.known ? (line.won ? "font-black text-ink" : "font-semibold text-ink") : "italic text-ink-faint"
            }`}
          >
            {line.label}
          </span>
          <span
            className={`min-w-6 rounded-md px-1 text-center text-[0.8rem] font-black tabular-nums ${
              line.won ? "bg-navy text-white" : "text-ink-muted"
            }`}
          >
            {line.score ?? ""}
            {line.pens !== null && line.score !== null ? (
              <sup className="ml-0.5 text-[0.55rem] font-bold">({line.pens})</sup>
            ) : null}
          </span>
        </div>
      ))}
    </>
  );

  const className =
    "bc-card relative block w-full p-3 transition after:absolute after:top-1/2 after:-right-4 after:h-px after:w-4 after:bg-line";

  return match ? (
    <Link href={`/matches/${match.id}`} className={`${className} hover:border-accent/50`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function Bracket({
  bracket,
  matches,
  teams,
}: {
  bracket: BracketData;
  matches: Match[];
  teams: Team[];
}) {
  if (bracket.slots.length === 0) return null;

  const matchIndex = new Map(matches.map((match) => [match.id, match]));
  const teamIndex = new Map(teams.map((team) => [team.slug, team]));
  const slotIndex = new Map(bracket.slots.map((slot) => [slot.slot, slot]));
  const hasSeeds = Object.keys(bracket.seeds).length > 0;

  return (
    <div>
      <p className="mb-3 px-1 text-[0.75rem] text-ink-muted">
        Top six qualify; #1 and #2 get byes to the semifinals and the higher seed hosts.{" "}
        {hasSeeds
          ? bracket.official
            ? "Seeds are final."
            : "Projected seeds from the current table."
          : "Seeds appear once conference play starts."}
      </p>
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <div className="grid min-w-[660px] grid-cols-3 gap-8">
          {COLUMNS.map((column, columnIndex) => (
            <div key={column.title} className="flex flex-col">
              <h3 className="bc-label mb-3 text-[0.66rem] text-ink-faint">{column.title}</h3>
              <div
                className={`flex flex-1 flex-col justify-around gap-4 ${
                  columnIndex === COLUMNS.length - 1 ? "[&>*]:after:hidden" : ""
                }`}
              >
                {column.slots.map((id) => {
                  const slot = slotIndex.get(id);
                  if (!slot) return null;
                  return (
                    <SlotCard
                      key={id}
                      slot={slot}
                      match={slot.matchId ? matchIndex.get(slot.matchId) : undefined}
                      bracket={bracket}
                      teams={teamIndex}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
