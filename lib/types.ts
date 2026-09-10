/**
 * The shape the CCIW scraper must eventually produce. Every page reads through
 * `lib/selectors.ts`, so replacing the fixtures in `lib/data` with live data is
 * the only change needed when the backend lands.
 */

export type Team = {
  slug: string;
  /** Short form used in tables and cards, e.g. "North Central". */
  name: string;
  fullName: string;
  nickname: string;
  /** Drives the generated badge fill. */
  primary: string;
  secondary: string;
  /** Two or three letters shown inside the badge. */
  abbr: string;
  location: string;
  venue: string;
};

export type MatchStatus = "scheduled" | "live" | "final" | "postponed";

export type MatchEventType = "goal" | "own-goal" | "penalty" | "yellow" | "red";

export type MatchEvent = {
  minute: number;
  type: MatchEventType;
  teamSlug: string;
  playerId: string;
  assistPlayerId?: string;
};

export type MatchSide = {
  teamSlug: string;
  score: number | null;
};

export type Match = {
  id: string;
  /** ISO 8601 with offset. */
  date: string;
  status: MatchStatus;
  /** Present only while status is "live". */
  minute?: number;
  home: MatchSide;
  away: MatchSide;
  venue: string;
  isConference: boolean;
  attendance?: number;
  referee?: string;
  events: MatchEvent[];
  lineups?: {
    home: { starters: string[]; subs: string[] };
    away: { starters: string[]; subs: string[] };
  };
};

export type Position = "GK" | "D" | "M" | "F";
export type ClassYear = "Fr." | "So." | "Jr." | "Sr.";

export type Player = {
  id: string;
  teamSlug: string;
  number: number;
  name: string;
  position: Position;
  year: ClassYear;
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
