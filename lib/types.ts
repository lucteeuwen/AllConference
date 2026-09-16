/**
 * The shapes every page renders. `lib/season-data.ts` builds them from the
 * Supabase tables the scraper fills, and `lib/selectors.ts` derives the rest.
 */

export type Team = {
  slug: string;
  /** Short form used in tables and cards, e.g. "North Central". */
  name: string;
  fullName: string;
  nickname: string;
  /** Drives the fallback badge fill when there is no logo. */
  primary: string;
  secondary: string;
  /** Two or three letters shown inside the fallback badge. */
  abbr: string;
  location: string;
  venue: string;
  isConference: boolean;
  logoUrl: string | null;
};

export type MatchStatus = "scheduled" | "live" | "final" | "postponed" | "canceled";

export type MatchStage = "regular" | "quarterfinal" | "semifinal" | "final" | "ncaa";

export type MatchEventType = "goal" | "own-goal" | "penalty" | "yellow" | "red";

export type MatchEvent = {
  minute: number;
  type: MatchEventType;
  /** Null when the box score names a team we could not place. */
  teamSlug: string | null;
  playerName: string;
  assistName?: string;
};

export type MatchSide = {
  /** Null while the side is still to be decided (tournament games). */
  teamSlug: string | null;
  /** Always set: a TBC stand-in when `teamSlug` is null. */
  team: Team;
  /** What the TBC side is waiting on, e.g. "Winner QF2" or "#3 seed". */
  placeholder?: string;
  score: number | null;
  /** Penalty shootout tally, when the match went to one. */
  pens?: number | null;
};

export type LineupEntry = {
  name: string;
  number: number | null;
  position: string | null;
};

export type Lineup = { starters: LineupEntry[]; subs: LineupEntry[] };

export type MatchVideo = {
  url: string;
  provider: "youtube" | "hudl" | "flo" | "other";
  /** Only for a specific YouTube video; channel links cannot be embedded. */
  embedUrl?: string;
  label: string;
};

export type Match = {
  id: string;
  /** ISO 8601 instant. */
  date: string;
  /** ISO instant the match went final, when known. */
  finishedAt: string | null;
  status: MatchStatus;
  /** Only when the source exposes it; many live feeds do not. */
  minute?: number;
  home: MatchSide;
  away: MatchSide;
  venue: string;
  isConference: boolean;
  stage: MatchStage;
  bracketSlot: string | null;
  attendance?: number;
  referee?: string;
  events: MatchEvent[];
  lineups?: { home: Lineup; away: Lineup };
  video?: MatchVideo;
  boxscoreUrl?: string;
  recapUrl?: string;
};

export type Position = "GK" | "D" | "M" | "F";

export type Player = {
  id: string;
  teamSlug: string;
  number: number | null;
  name: string;
  /** Null when the school's roster leaves the position blank. */
  position: Position | null;
  /** As the school prints it: "Fr.", "So.", "Jr.", "Sr.", "Gr.", "R-Jr." … */
  year: string;
  hometown: string;
  height: string;
  stats: {
    gp: number;
    gs: number;
    goals: number;
    assists: number;
  };
};

export type Result = "W" | "L" | "D";

export type RecordLine = {
  w: number;
  l: number;
  d: number;
  pts: number;
  gf: number;
  ga: number;
};

export type StandingsRow = {
  teamSlug: string;
  conference: RecordLine;
  overall: RecordLine;
  home: RecordLine;
  away: RecordLine;
  /** Most recent result last. */
  form: Result[];
};

export type StandingsSplit = "all" | "home" | "away";

export type BracketSlotId = "qf1" | "qf2" | "sf1" | "sf2" | "final";

export type BracketSlot = {
  slot: BracketSlotId;
  round: "quarterfinal" | "semifinal" | "final";
  homeSeed: number | null;
  awaySeed: number | null;
  homeFrom: BracketSlotId | null;
  awayFrom: BracketSlotId | null;
  matchId: string | null;
};

export type Bracket = {
  season: number;
  /** Seed number to team slug. */
  seeds: Record<number, string>;
  official: boolean;
  slots: BracketSlot[];
};
