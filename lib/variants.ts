/** The five home-page designs offered by the switcher. */

export const variants = [
  {
    id: "broadcast",
    label: "Broadcast",
    blurb: "Scoreboard rail and a split-colour matchup hero",
  },
  {
    id: "glass",
    label: "Stadium Glass",
    blurb: "Translucent cards over a drifting navy glow",
  },
  {
    id: "ticket",
    label: "Matchday Ticket",
    blurb: "Perforated stubs and a pulsing live badge",
  },
  {
    id: "broadsheet",
    label: "Broadsheet",
    blurb: "Editorial whitespace and team-coloured rules",
  },
  {
    id: "kinetic",
    label: "Kinetic",
    blurb: "Ticker, odometer scores and oversized type",
  },
] as const;

export type VariantId = (typeof variants)[number]["id"];

export const defaultVariant: VariantId = "broadcast";

export function parseVariant(value: string | string[] | undefined): VariantId {
  const raw = Array.isArray(value) ? value[0] : value;
  const match = variants.find((variant) => variant.id === raw);
  return match ? match.id : defaultVariant;
}
