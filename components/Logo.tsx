type Props = {
  className?: string;
  /**
   * Colour of the hairline gaps where the slash crosses the letterforms. It has
   * to match whatever sits behind the mark, so callers on a coloured panel pass
   * that panel's colour.
   */
  gap?: string;
  title?: string;
};

/**
 * The AllConference monogram: an angular A and C crossed by a speed slash.
 * Fill follows `currentColor`, so it takes the colour of whatever it sits in.
 *
 * Rebuilt as vector from the supplied raster artwork. If the original vector
 * file turns up, replace the three paths here and everything else follows.
 */
export function Logo({ className = "", gap = "var(--surface)", title }: Props) {
  return (
    <svg
      viewBox="0 0 140 100"
      className={className}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* A, with its left leg running out into a blade. */}
      <path
        d="M40 5 L57 5 L81 78 L63 78 L57 60 L37 60 L31 78 L22 99 L14 78 Z M42 47 L52 47 L47 29 Z"
        fillRule="evenodd"
      />
      {/* C */}
      <path d="M135 29 L108 29 L100 37 L100 57 L108 65 L135 65 L135 85 L96 85 L84 71 L84 23 L96 9 L135 9 Z" />
      {/* The slash, drawn last with a background-coloured halo so it reads as
          cutting through the letters rather than merging with them. */}
      <path
        d="M2 73 L118 28 L118 20 L138 20 L138 31 L6 83 L2 83 Z"
        stroke={gap}
        strokeWidth="3.5"
        paintOrder="stroke"
      />
    </svg>
  );
}

/** The mark on its brand-blue rounded tile, for nav and app-icon use. */
export function LogoTile({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-[26%] bg-brand text-white ${className}`}
    >
      <Logo className="w-[62%]" gap="var(--brand)" />
    </span>
  );
}
