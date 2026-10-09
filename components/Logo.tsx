import Image from "next/image";
import logoMarkWhite from "@/public/brand/logo-mark-white.png";
import logoTile from "@/public/brand/logo-tile.png";

/**
 * The AllConference mark in white with a transparent background, for the navy
 * header band. Derived from public/brand/logo_primary.png.
 */
export function LogoMark({ className = "", title }: { className?: string; title?: string }) {
  return (
    <Image
      src={logoMarkWhite}
      alt={title ?? ""}
      className={className}
    />
  );
}

/** The mark on its brand-blue rounded tile, for nav and app-icon use. */
export function LogoTile({ className = "" }: { className?: string }) {
  return (
    <span className={`relative block shrink-0 ${className}`}>
      <Image src={logoTile} alt="" fill sizes="40px" className="object-contain" />
    </span>
  );
}
