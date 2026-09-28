import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DetailRow } from "@/components/DetailRow";
import { EventIcon } from "@/components/EventIcon";
import { WashHero } from "@/components/broadcast/WashHero";
import { OverlapCard } from "@/components/broadcast/OverlapCard";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { TeamBadge } from "@/components/TeamBadge";
import { Tabs } from "@/components/Tabs";
import { formatShortDate } from "@/lib/format";
import { buildGameLog, playerLookup, summarize } from "@/lib/players";
import { SEASON_LABEL } from "@/lib/season";
import { getPlayerDetails, getSeasonData } from "@/lib/season-data";
import { competitionLabel, getTeam, resultFor, standingsLines } from "@/lib/selectors";
import type { Player, PlayerGame, PlayerProfile, Result, Team } from "@/lib/types";

type Props = PageProps<"/players/[id]">;

function findPlayer(players: Player[], id: string): Player | undefined {
  return players.find((player) => player.id === id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getSeasonData();
  const player = findPlayer(data.players, id);
  if (!player) return { title: "Player not found" };
  const team = getTeam(data, player.teamSlug);
  return { title: team ? `${player.name} · ${team.name}` : player.name };
}

const positionNames: Record<NonNullable<Player["position"]>, string> = {
  GK: "Goalkeeper",
  D: "Defender",
  M: "Midfielder",
  F: "Forward",
};

/** The roster's spelled-out position, unless it is only the short code again. */
function positionName(player: Player, profile: PlayerProfile | null): string | null {
  const long = profile?.positionLong;
  if (long && long.length > 3) return long;
  return player.position ? positionNames[player.position] : null;
}

const years: Record<string, string> = {
  fr: "Freshman",
  so: "Sophomore",
  jr: "Junior",
  sr: "Senior",
  gr: "Graduate",
  "5th": "Fifth year",
};

/** "R-Jr." → "Redshirt Junior"; anything unrecognised is shown as printed. */
function yearName(year: string): string {
  const clean = year.trim();
  const redshirt = /^r-?\s*/i.test(clean) && clean.length > 3;
  const key = clean.replace(/^r-?\s*/i, "").replace(/\.$/, "").toLowerCase();
  const name = years[key];
  if (!name) return clean;
  return redshirt ? `Redshirt ${name.toLowerCase()}` : name;
}

/** "6-1" → 6′1″. */
function heightName(height: string): string {
  const match = height.match(/^(\d)\s*[-'’]\s*(\d{1,2})/);
  return match ? `${match[1]}′${match[2]}″` : height;
}

const ordinal = (n: number) => {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

const rankText = (rank: { rank: number; tied: boolean } | null, of: string) =>
  rank ? `${rank.tied ? "T-" : ""}${ordinal(rank.rank)} ${of}` : null;

const percent = (value: number | null) => (value === null ? null : `${Math.round(value * 100)}%`);
const oneDecimal = (value: number | null) => (value === null ? null : value.toFixed(value < 10 ? 2 : 1));

function Stat({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-[1.3rem] font-black tabular-nums ${accent ? "text-accent" : "text-ink"}`}>{value}</p>
      <p className="bc-label text-[0.62rem] text-ink-faint">{label}</p>
    </div>
  );
}

/** A DetailRow that disappears when there is nothing to say. */
function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return <DetailRow label={label} value={value} />;
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="bc-label inline-flex rounded-control border border-line px-3 py-2 text-[0.68rem] text-ink-muted transition hover:border-accent hover:text-accent"
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

const resultTone: Record<Result, string> = { W: "bg-win", L: "bg-loss", D: "bg-draw" };

/** "vs Wheaton" at home, "@ Wheaton" away. */
function opponentOf(game: PlayerGame, teamSlug: string): { team: Team; home: boolean; name: string } {
  const home = game.match.home.teamSlug === teamSlug;
  const side = home ? game.match.away : game.match.home;
  return { team: side.team, home, name: side.teamSlug ? side.team.name : (side.placeholder ?? "TBC") };
}

function GameRow({ game, teamSlug }: { game: PlayerGame; teamSlug: string }) {
  const { match } = game;
  const opponent = opponentOf(game, teamSlug);
  const result = resultFor(match, teamSlug);
  const own = opponent.home ? match.home.score : match.away.score;
  const other = opponent.home ? match.away.score : match.home.score;
  const role = game.started === true ? "Started" : game.started === false ? "Sub" : null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="bc-card bc-pad bc-shadow block transition hover:border-accent/40"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="bc-label truncate text-[0.66rem] text-ink-faint">
          {formatShortDate(match.date, match.timezone)} · {competitionLabel(match)}
        </span>
        {result && own !== null && other !== null ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[0.78rem] font-black text-ink tabular-nums">
            <span
              className={`inline-flex size-5 items-center justify-center rounded-full text-[0.6rem] text-white ${resultTone[result]}`}
            >
              {result}
            </span>
            {own}–{other}
          </span>
        ) : (
          <span className="bc-label shrink-0 text-[0.62rem] text-ink-faint">
            {match.status === "live" ? "Live" : "—"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <span className="w-4 shrink-0 text-[0.72rem] font-bold text-ink-faint">{opponent.home ? "vs" : "@"}</span>
        <TeamBadge team={opponent.team} size="sm" />
        <span className="min-w-0 flex-1 truncate text-[0.85rem] font-semibold text-ink">{opponent.name}</span>

        <span className="flex shrink-0 items-center gap-2 text-[0.72rem] text-ink-muted">
          {Array.from({ length: game.goals }, (_, index) => (
            <EventIcon key={`g${index}`} type="goal" />
          ))}
          {game.assists > 0 ? (
            <span className="font-bold text-ink">
              {game.assists > 1 ? `${game.assists} ` : ""}A
            </span>
          ) : null}
          {Array.from({ length: game.yellow }, (_, index) => (
            <EventIcon key={`y${index}`} type="yellow" />
          ))}
          {Array.from({ length: game.red }, (_, index) => (
            <EventIcon key={`r${index}`} type="red" />
          ))}
          {role ? (
            <span className="bc-label rounded-control bg-ground px-2 py-0.5 text-[0.6rem] text-ink-muted">
              {role}
              {game.position ? ` · ${game.position}` : ""}
            </span>
          ) : null}
        </span>
      </div>
      {game.goals > 0 ? (
        <span className="sr-only">
          {game.goals} {game.goals === 1 ? "goal" : "goals"}
        </span>
      ) : null}
    </Link>
  );
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const data = await getSeasonData();
  const player = findPlayer(data.players, id);
  if (!player) notFound();
  const team = getTeam(data, player.teamSlug);
  if (!team) notFound();

  const query = await searchParams;
  const requested = Array.isArray(query.tab) ? query.tab[0] : query.tab;

  const { profile, lineups, events } = await getPlayerDetails(player.id, player.teamSlug);
  const games = buildGameLog(player, data.matches, lineups, events, playerLookup(data.players));

  const conferenceSlugs = new Set(data.conference.map((entry) => entry.slug));
  const conferencePlayers = data.players.filter((entry) => conferenceSlugs.has(entry.teamSlug));
  const standings = standingsLines(data);
  const teamRow = standings.find((line) => line.team.slug === team.slug)?.row;
  const summary = summarize(player, profile, games, conferencePlayers, teamRow?.overall.gf ?? null);

  const { stats } = player;
  const keeper = profile?.keeper ?? null;
  // A keeper who played in goal gets the goalkeeping line up top.
  const keeperFirst = player.position === "GK" && keeper !== null;
  const position = positionName(player, profile);

  const tabs = [
    { key: "overview", label: "Overview", href: `/players/${player.id}?tab=overview` },
    { key: "games", label: `Game log (${games.length})`, href: `/players/${player.id}?tab=games` },
  ];
  const active = tabs.some((tab) => tab.key === requested) ? (requested as string) : "overview";

  const subtitle = [player.number !== null ? `#${player.number}` : null, position, player.year ? yearName(player.year) : null]
    .filter(Boolean)
    .join(" · ");

  const cardsText =
    profile?.yellowCards != null || profile?.redCards != null
      ? `${profile?.yellowCards ?? 0} yellow · ${profile?.redCards ?? 0} red`
      : null;

  return (
    <div className="bc-stack pt-4 md:pt-6">
      <section>
        <WashHero home={team}>
          <div className="mb-5 flex items-center justify-between">
            <BackButton fallbackHref={`/teams/${team.slug}`} label="Back">
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </BackButton>
            <div className="flex items-center gap-2">
              <span className="bc-label rounded-control bg-white/10 px-3 py-1.5 text-[0.66rem] text-white/80">
                {SEASON_LABEL}
              </span>
              <ThemeToggle tone="onDark" className="md:hidden" />
            </div>
          </div>

          <div className="slide-from-left flex flex-col items-center gap-4 md:flex-row md:justify-center md:gap-7 md:text-left">
            <PlayerPhoto player={player} team={team} photoUrl={profile?.photoUrl ?? null} size={128} />
            <div className="flex flex-col items-center gap-2 md:items-start">
              {subtitle ? <p className="bc-label text-[0.72rem] text-white/70">{subtitle}</p> : null}
              <h1 className="bc-title text-[1.7rem] text-white md:text-[2.2rem]">{player.name}</h1>
              <Link
                href={`/teams/${team.slug}`}
                className="flex items-center gap-2 text-[0.8rem] font-semibold text-white/80 transition hover:text-white"
              >
                <TeamBadge team={team} size="xs" />
                {team.fullName}
              </Link>
              {profile?.captain ? (
                <span className="bc-label rounded-control bg-white/12 px-2.5 py-1 text-[0.62rem] text-white/85">
                  Captain
                </span>
              ) : null}
            </div>
          </div>
        </WashHero>

        <OverlapCard>
          {keeperFirst && keeper ? (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
              <Stat label="Played" value={stats.gp} />
              <Stat label="Started" value={stats.gs} />
              <Stat label="Saves" value={keeper.saves} accent />
              <Stat label="Conceded" value={keeper.goalsAgainst} />
              <Stat label="Save %" value={percent(summary.keeper?.savePct ?? null) ?? "–"} />
              <Stat label="Shutouts" value={keeper.shutouts} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
              <Stat label="Played" value={stats.gp} />
              <Stat label="Started" value={stats.gs} />
              <Stat label="Goals" value={stats.goals} accent />
              <Stat label="Assists" value={stats.assists} accent />
              <Stat label="Points" value={summary.points} />
              {profile?.minutes != null ? (
                <Stat label="Minutes" value={profile.minutes.toLocaleString("en-US")} />
              ) : profile?.shots != null ? (
                <Stat label="Shots" value={profile.shots} />
              ) : (
                <Stat label="Goals / game" value={oneDecimal(summary.goalsPerGame) ?? "–"} />
              )}
            </div>
          )}
        </OverlapCard>
      </section>

      <div>
        <div className="mb-5 px-1">
          <Tabs tabs={tabs} active={active} />
        </div>

        {active === "overview" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bc-card bc-pad bc-shadow">
              <h2 className="bc-label mb-2 text-[0.7rem] text-ink-faint">Player facts</h2>
              <Fact
                label="Team"
                value={
                  <Link href={`/teams/${team.slug}`} className="hover:text-accent">
                    {team.fullName}
                  </Link>
                }
              />
              <Fact label="Number" value={player.number !== null ? `#${player.number}` : null} />
              <Fact label="Position" value={position} />
              <Fact label="Class" value={player.year ? yearName(player.year) : null} />
              <Fact label="Height" value={player.height ? heightName(player.height) : null} />
              <Fact label="Weight" value={profile?.weight ? `${profile.weight} lbs` : null} />
              <Fact label="Hometown" value={player.hometown} />
              <Fact label="High school" value={profile?.highSchool} />
              <Fact label="Previous school" value={profile?.previousSchool} />
              <Fact label="Major" value={profile?.major} />
              <Fact label="Captain" value={profile?.captain ? "Yes" : null} />
              {profile?.bioUrl ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <ExternalLink href={profile.bioUrl}>Official bio</ExternalLink>
                </div>
              ) : null}
            </div>

            <div className="bc-card bc-pad bc-shadow">
              <h2 className="bc-label mb-2 text-[0.7rem] text-ink-faint">Season stats</h2>
              <DetailRow label="Games played" value={stats.gp} />
              <DetailRow label="Games started" value={stats.gs} />
              <Fact label="Minutes" value={profile?.minutes?.toLocaleString("en-US")} />
              <DetailRow label="Goals" value={stats.goals} />
              <DetailRow label="Assists" value={stats.assists} />
              <DetailRow label="Points" value={summary.points} note="2 per goal, 1 per assist" />
              <Fact label="Shots" value={profile?.shots} />
              <Fact label="Shots on goal" value={profile?.shotsOnGoal} />
              <Fact label="Shot accuracy" value={percent(summary.shotAccuracy)} />
              <Fact label="Shot conversion" value={percent(summary.conversion)} />
              <Fact label="Game-winning goals" value={profile?.gameWinners} />
              <Fact
                label="Penalties"
                value={profile?.pkAttempts ? `${profile.pkGoals ?? 0} of ${profile.pkAttempts} scored` : null}
              />
              <Fact label="Goals per game" value={stats.goals > 0 ? oneDecimal(summary.goalsPerGame) : null} />
              <Fact
                label="Minutes per goal"
                value={summary.minutesPerGoal !== null ? Math.round(summary.minutesPerGoal) : null}
              />
              <Fact label="Cards" value={cardsText} />
            </div>

            {keeper ? (
              <div className="bc-card bc-pad bc-shadow">
                <h2 className="bc-label mb-2 text-[0.7rem] text-ink-faint">Goalkeeping</h2>
                <DetailRow label="Minutes in goal" value={keeper.minutes.toLocaleString("en-US")} />
                <DetailRow label="Record" value={`${keeper.wins}-${keeper.losses}-${keeper.ties}`} note="W-L-T" />
                <DetailRow label="Saves" value={keeper.saves} />
                <DetailRow label="Goals conceded" value={keeper.goalsAgainst} />
                <Fact label="Save percentage" value={percent(summary.keeper?.savePct ?? null)} />
                <Fact label="Goals against average" value={summary.keeper?.gaa?.toFixed(2)} />
                <DetailRow label="Shutouts" value={keeper.shutouts} />
              </div>
            ) : null}

            <div className="bc-card bc-pad bc-shadow">
              <h2 className="bc-label mb-2 text-[0.7rem] text-ink-faint">Standing out</h2>
              <Fact label="Goals in the CCIW" value={rankText(summary.conferenceRank.goals, "of all players")} />
              <Fact label="Assists in the CCIW" value={rankText(summary.conferenceRank.assists, "of all players")} />
              <Fact label={`Goals at ${team.name}`} value={rankText(summary.teamRank.goals, "on the team")} />
              <Fact label={`Assists at ${team.name}`} value={rankText(summary.teamRank.assists, "on the team")} />
              <Fact
                label="Share of team goals"
                value={stats.goals > 0 && summary.teamGoalShare !== null ? percent(summary.teamGoalShare) : null}
              />
              <Fact
                label="Team record when starting"
                value={
                  summary.startedRecord
                    ? `${summary.startedRecord.w}-${summary.startedRecord.d}-${summary.startedRecord.l}`
                    : null
                }
              />
              <Fact label="Multi-goal games" value={summary.multiGoalGames > 0 ? summary.multiGoalGames : null} />
              <Fact
                label="First goal"
                value={
                  summary.firstGoal ? (
                    <Link href={`/matches/${summary.firstGoal.match.id}`} className="hover:text-accent">
                      {opponentOf(summary.firstGoal, team.slug).home ? "vs" : "@"}{" "}
                      {opponentOf(summary.firstGoal, team.slug).name},{" "}
                      {formatShortDate(summary.firstGoal.match.date, summary.firstGoal.match.timezone)}
                    </Link>
                  ) : null
                }
              />
              <Fact
                label="Latest appearance"
                value={
                  summary.latest ? (
                    <Link href={`/matches/${summary.latest.match.id}`} className="hover:text-accent">
                      {opponentOf(summary.latest, team.slug).home ? "vs" : "@"}{" "}
                      {opponentOf(summary.latest, team.slug).name},{" "}
                      {formatShortDate(summary.latest.match.date, summary.latest.match.timezone)}
                    </Link>
                  ) : null
                }
              />
              {!summary.conferenceRank.goals &&
              !summary.conferenceRank.assists &&
              !summary.startedRecord &&
              !summary.latest ? (
                <p className="py-4 text-center text-[0.82rem] text-ink-muted">
                  Nothing to single out yet. Rankings and milestones appear once {player.name.split(" ")[0]} gets on
                  the scoresheet.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {active === "games" ? (
          games.length === 0 ? (
            <div className="bc-card bc-pad bc-shadow text-center text-[0.82rem] text-ink-muted">
              No box score this season lists {player.name} yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="px-1 text-[0.72rem] text-ink-faint">
                Every game a published box score lists {player.name} in, latest first.
              </p>
              {[...games].reverse().map((game) => (
                <GameRow key={game.match.id} game={game} teamSlug={team.slug} />
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
