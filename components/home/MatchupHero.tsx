"use client";

import Link from "next/link";
import { TeamBadge } from "@/components/TeamBadge";
import { Confetti } from "@/components/home/Confetti";
import { tint } from "@/lib/color";
import type { Match, Team } from "@/lib/types";

type Props = {
  match: Match;
  home: Team;
  away: Team;
  kickoff: string;
};

/**
 * The reference video's centrepiece: each school's colour washes in from its
 * own edge toward a dark centre, oversized crests bleed off both sides, and a
 * split rule underneath splits home colour from away colour at the midpoint.
 */
export function MatchupHero({ match, home, away, kickoff }: Props) {
  const decided = match.home.score !== null && match.away.score !== null;
  const live = match.status === "live";

  return (
    <div className="relative overflow-hidden rounded-card bg-navy-deep">
      {/* Colour washes, one per side, meeting in a dark centre. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(100deg, ${home.primary} -10%, transparent 42%), linear-gradient(260deg, ${away.primary} -10%, transparent 42%)`,
        }}
      />
      {/* Speckle, standing in for the video's textured hero. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(${tint("#ffffff", 0.16)} 1px, transparent 1px)`,
          backgroundSize: "26px 26px",
        }}
      />

      <span
        aria-hidden="true"
        className="watermark-in absolute -left-10 top-1/2 -translate-y-1/2 text-[150px] leading-none font-black tracking-tighter select-none md:text-[210px]"
        style={
          {
            color: home.primary,
            "--watermark-from": "-60px",
            "--watermark-opacity": 0.28,
          } as React.CSSProperties
        }
      >
        {home.abbr}
      </span>
      <span
        aria-hidden="true"
        className="watermark-in absolute -right-10 top-1/2 -translate-y-1/2 text-[150px] leading-none font-black tracking-tighter select-none md:text-[210px]"
        style={
          {
            color: away.primary,
            "--watermark-from": "60px",
            "--watermark-opacity": 0.28,
            animationDelay: "120ms",
          } as React.CSSProperties
        }
      >
        {away.abbr}
      </span>

      {live ? <Confetti seed={match.id} colors={[home.primary, away.primary, "#ffffff"]} /> : null}

      <div className="relative px-5 py-7 text-center md:px-8 md:py-9">
        <p className="text-[13px] font-black tracking-[0.14em] text-white/70 uppercase md:text-[15px]">
          {home.name} <span className="text-white/35">@</span> {away.name}
        </p>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="slide-from-left flex flex-col items-center gap-2">
            <TeamBadge team={home} size="lg" ring />
            <span className="text-[12px] font-semibold text-white">{home.name}</span>
          </div>

          <div className="relative">
            {live ? (
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-win px-3 py-1 text-[11px] font-black text-white tabular-nums">
                <span className="live-dot size-1.5 rounded-full bg-white" />
                {match.minute}&apos;
              </span>
            ) : (
              <span className="mb-2 inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white/85">
                {kickoff}
              </span>
            )}

            {decided ? (
              <>
                {live ? (
                  <span
                    aria-hidden="true"
                    className="score-bloom pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-black text-white"
                  >
                    {match.away.score}
                  </span>
                ) : null}
                <div className="rise-in text-4xl font-black text-white tabular-nums md:text-5xl">
                  {match.home.score}
                  <span className="mx-2 text-white/30">-</span>
                  {match.away.score}
                </div>
              </>
            ) : (
              <div className="text-2xl font-black text-white md:text-3xl">VS</div>
            )}

            <p className="mt-1.5 text-[10px] font-semibold tracking-[0.1em] text-white/55 uppercase">
              {match.isConference ? "CCIW Conference" : "Non-conference"}
            </p>
          </div>

          <div className="slide-from-right flex flex-col items-center gap-2">
            <TeamBadge team={away} size="lg" ring />
            <span className="text-[12px] font-semibold text-white">{away.name}</span>
          </div>
        </div>

        <Link
          href={`/matches/${match.id}`}
          className="mt-6 inline-flex rounded-full border border-white/25 px-5 py-2 text-[12px] font-bold tracking-wide text-white uppercase transition hover:bg-white hover:text-navy"
        >
          View match
        </Link>
      </div>

      {/* Split rule: home colour left of centre, away colour right. */}
      <div aria-hidden="true" className="relative flex h-1">
        <span className="flex-1" style={{ background: home.primary }} />
        <span className="flex-1" style={{ background: away.primary }} />
      </div>
    </div>
  );
}
