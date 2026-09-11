"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number;
  className?: string;
};

/**
 * A score that rolls into place like a split-flap board. Each digit is a
 * vertical strip of 0-9 translated to the right offset; the roll comes from
 * animating that translation on mount.
 */
export function Odometer({ value, className = "" }: Props) {
  const [rolled, setRolled] = useState(false);

  useEffect(() => {
    // Let the browser paint the start position before the roll begins.
    const frame = requestAnimationFrame(() => setRolled(true));
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const digits = String(Math.max(0, value)).split("");

  return (
    <span className={`inline-flex tabular-nums ${className}`} aria-label={String(value)}>
      {digits.map((digit, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="relative inline-block overflow-hidden"
          style={{ height: "1em", width: "0.62em" }}
        >
          <span
            className="odometer-track absolute inset-x-0 top-0 flex flex-col items-center"
            style={
              {
                "--roll-from": "0em",
                "--roll-to": `${-Number(digit)}em`,
                animationDelay: `${index * 90}ms`,
                transform: rolled ? `translateY(${-Number(digit)}em)` : "translateY(0)",
              } as React.CSSProperties
            }
          >
            {Array.from({ length: 10 }, (_, n) => (
              <span key={n} className="block" style={{ height: "1em", lineHeight: "1em" }}>
                {n}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
