import { createRng } from "@/lib/rng";

type Props = {
  /** Usually the two schools' primary colours. */
  colors: string[];
  /** Stable seed, so server and client generate the same burst. */
  seed: string;
  count?: number;
};

/**
 * The burst that fires when a score changes, lifted from the reference video.
 * Shards are laid out from a seeded generator rather than Math.random so the
 * markup matches on hydration, and the animation's `both` fill leaves them
 * invisible once it has played. Reduced motion hides them in CSS.
 */
export function Confetti({ colors, seed, count = 26 }: Props) {
  const rng = createRng(`confetti:${seed}`);

  const shards = Array.from({ length: count }, (_, index) => {
    const fromLeft = index % 2 === 0;
    const size = 5 + rng.next() * 7;
    return {
      left: fromLeft ? rng.next() * 28 : 72 + rng.next() * 28,
      top: 30 + rng.next() * 40,
      dx: (fromLeft ? 1 : -1) * (60 + rng.next() * 220),
      dy: -60 - rng.next() * 190,
      spin: (rng.next() - 0.5) * 900,
      duration: 1.5 + rng.next() * 1.1,
      delay: rng.next() * 0.45,
      size,
      color: colors[index % colors.length],
      round: rng.next() > 0.6,
    };
  });

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {shards.map((shard, index) => (
        <span
          key={index}
          className={`confetti-shard absolute ${shard.round ? "rounded-full" : "rounded-[1px]"}`}
          style={
            {
              left: `${shard.left}%`,
              top: `${shard.top}%`,
              width: shard.size,
              height: shard.round ? shard.size : shard.size * 0.45,
              background: shard.color,
              "--dx": `${shard.dx}px`,
              "--dy": `${shard.dy}px`,
              "--spin": `${shard.spin}deg`,
              "--dur": `${shard.duration}s`,
              "--delay": `${shard.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
