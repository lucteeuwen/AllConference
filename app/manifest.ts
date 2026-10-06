import type { MetadataRoute } from "next";

/** The navy chrome colour (`--navy` in globals.css), used for the splash and status bar. */
const NAVY = "#0a1e3c";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CCIW Men's Soccer",
    short_name: "CCIW Soccer",
    description:
      "Results, fixtures, standings and rosters for College Conference of Illinois and Wisconsin men's soccer.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: NAVY,
    theme_color: NAVY,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
