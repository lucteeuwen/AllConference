import Image from "next/image";

/**
 * The AllConference mark in white with a transparent background, for the navy
 * header band. Derived from public/brand/logo_primary.png.
 */
export function LogoMark({ className = "", title }: { className?: string; title?: string }) {
  return (
    <Image
      src="/brand/logo-mark-white.png"
      alt={title ?? ""}
      width={687}
      height={491}
      className={className}
    />
  );
}

/** The mark on its brand-blue rounded tile, for nav and app-icon use. */
export function LogoTile({ className = "" }: { className?: string }) {
  return (
    <span className={`relative block shrink-0 ${className}`}>
      <Image src="/brand/logo-tile.png" alt="" fill sizes="40px" className="object-contain" />
    </span>
  );
}
