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
  /** IANA zone of the school's own ground; null for one we could not place. */
  timezone: string | null;
  isConference: boolean;
  logoUrl: string | null;
  /** Place in the national poll; null when unranked. */
  nationalRank: number | null;
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
  /** True only when the link goes to this game's own stream or replay. */
  exact: boolean;
  /** The service the link is on, e.g. "CCIW Network". */
  platform: string;
  /** A Hudl broadcast id, so it can be checked against the broadcast's title. */
  broadcastId?: string;
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
  /** ISO instant play is estimated to have begun, once the scraper has seen it. */
  startedAt?: string;
  home: MatchSide;
  away: MatchSide;
  venue: string;
  /**
   * IANA zone of the ground. Resolved on read, so it is always a real zone:
   * the match's own, else the home side's, else the conference's.
   */
  timezone: string;
  /**
   * No kickoff published yet. `date` is then a day anchor (noon at the venue),
   * not a time, so it must never be rendered as one.
   */
  timeTbd: boolean;
  isConference: boolean;
  stage: MatchStage;
  bracketSlot: string | null;
  attendance?: number;
  referee?: string;
  events: MatchEvent[];
  lineups?: { home: Lineup; away: Lineup };
  video?: MatchVideo;
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

/**
 * What the player page adds to `Player`: the rest of the school's roster card
 * and season stats. Every field is optional, since rosters differ per school.
 */
export type PlayerProfile = {
  photoUrl: string | null;
  /** "Midfielder/Forward". */
  positionLong: string | null;
  weight: string | null;
  highSchool: string | null;
  previousSchool: string | null;
  major: string | null;
  captain: boolean;
  minutes: number | null;
  shots: number | null;
  shotsOnGoal: number | null;
  gameWinners: number | null;
  pkGoals: number | null;
  pkAttempts: number | null;
  yellowCards: number | null;
  redCards: number | null;
  /** Only for a player who has kept goal. */
  keeper: {
    minutes: number;
    goalsAgainst: number;
    saves: number;
    wins: number;
    losses: number;
    ties: number;
    shutouts: number;
  } | null;
};

/** One game in a player's log, read from the box score we hold. */
export type PlayerGame = {
  match: Match;
  /** Null when the box score has no lineup, only the player's events. */
  started: boolean | null;
  position: string | null;
  goals: number;
  penalties: number;
  assists: number;
  yellow: number;
  red: number;
  /** Minutes of the player's goals, in order. */
  goalMinutes: number[];
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
  /** Home/away, restricted to conference games; what the Home/Away splits show once conference play starts. */
  homeConference: RecordLine;
  awayConference: RecordLine;
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
