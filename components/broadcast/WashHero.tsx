import type { ReactNode } from "react";
import { Confetti } from "@/components/broadcast/Confetti";
import type { Team } from "@/lib/types";

type Props = {
  /** One team tints the whole panel; two split it down the middle. */
  home: Team;
  away?: Team;
  children: ReactNode;
  /** Fires the score-change burst. Only used for a match in progress. */
  celebrate?: string | false;
};

/**
 * The reference video's signature panel: each school's colour washes in from
 * its own edge toward a dark centre, an oversized abbreviation bleeds off the
 * side, and a rule underneath splits home colour from away colour.
 *
 * Wash strength, watermark opacity and rule height all come from tokens, so
 * the design sidebar drives them everywhere this is used.
 */
export function WashHero({ home, away, children, celebrate }: Props) {
  const solo = !away;

  const wash = solo
    ? `linear-gradient(var(--wash-angle), color-mix(in oklab, ${home.primary} calc(85% * var(--wash-strength)), transparent) -10%, transparent 78%)`
    : `linear-gradient(var(--wash-angle), color-mix(in oklab, ${home.primary} calc(100% * var(--wash-strength)), transparent) -10%, transparent 42%),
       linear-gradient(calc(360deg - var(--wash-angle)), color-mix(in oklab, ${away.primary} calc(100% * var(--wash-strength)), transparent) -10%, transparent 42%)`;

  return (
    <div className="relative overflow-hidden rounded-card bg-navy-deep">
      <div aria-hidden="true" className="absolute inset-0" style={{ background: wash }} />

      {/* Speckle, standing in for the video's textured hero. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      <Watermark team={home} side="left" />
      {away ? <Watermark team={away} side="right" delay="120ms" /> : null}

      {celebrate ? (
        <Confetti
          seed={celebrate}
          colors={[home.primary, away?.primary ?? home.secondary, "#ffffff"]}
        />
      ) : null}

      <div
        className="relative text-center"
        style={{ padding: "var(--hero-pad) calc(var(--hero-pad) * 0.75)" }}
      >
        {children}
      </div>

      <div aria-hidden="true" className="bc-rule relative flex" style={{ height: "var(--rule-height)" }}>
        <span className="team-color flex-1" style={{ background: home.primary }} />
        {away ? <span className="team-color flex-1" style={{ background: away.primary }} /> : null}
      </div>
    </div>
  );
}

function Watermark({ team, side, delay }: { team: Team; side: "left" | "right"; delay?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`bc-watermark watermark-in absolute top-1/2 -translate-y-1/2 leading-none font-black tracking-tighter select-none ${
        side === "left" ? "-left-10" : "-right-10"
      }`}
      style={
        {
          color: team.primary,
          fontSize: "calc(9.5rem * var(--wm-scale))",
          "--watermark-from": side === "left" ? "-60px" : "60px",
          animationDelay: delay,
        } as React.CSSProperties
      }
    >
      {team.abbr}
    </span>
  );
}
