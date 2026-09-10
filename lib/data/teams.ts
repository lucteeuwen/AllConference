import type { Team } from "@/lib/types";

/**
 * CCIW (College Conference of Illinois and Wisconsin) members.
 *
 * NOTE: colors, nicknames and venue names are best-effort placeholders for the
 * dummy dataset. Verify each against the school's official athletics site
 * before this ships with real scraped data. They only affect badge tinting.
 */
export const teams: Team[] = [
  {
    slug: "augustana",
    name: "Augustana",
    fullName: "Augustana College",
    nickname: "Vikings",
    primary: "#003057",
    secondary: "#f2a900",
    abbr: "AUG",
    location: "Rock Island, IL",
    venue: "Thorson-Lucken Field",
  },
  {
    slug: "carroll",
    name: "Carroll",
    fullName: "Carroll University",
    nickname: "Pioneers",
    primary: "#e35205",
    secondary: "#1c1c1c",
    abbr: "CAR",
    location: "Waukesha, WI",
    venue: "Schneider Stadium",
  },
  {
    slug: "carthage",
    name: "Carthage",
    fullName: "Carthage College",
    nickname: "Firebirds",
    primary: "#a6192e",
    secondary: "#ffffff",
    abbr: "CTH",
    location: "Kenosha, WI",
    venue: "Art Keller Field",
  },
  {
    slug: "elmhurst",
    name: "Elmhurst",
    fullName: "Elmhurst University",
    nickname: "Bluejays",
    primary: "#003da5",
    secondary: "#ffffff",
    abbr: "ELM",
    location: "Elmhurst, IL",
    venue: "Langhorst Field",
  },
  {
    slug: "illinois-wesleyan",
    name: "Illinois Wesleyan",
    fullName: "Illinois Wesleyan University",
    nickname: "Titans",
    primary: "#00573f",
    secondary: "#ffffff",
    abbr: "IWU",
    location: "Bloomington, IL",
    venue: "Neis Soccer Field",
  },
  {
    slug: "millikin",
    name: "Millikin",
    fullName: "Millikin University",
    nickname: "Big Blue",
    primary: "#00539b",
    secondary: "#ffffff",
    abbr: "MIL",
    location: "Decatur, IL",
    venue: "Workman Family Field",
  },
  {
    slug: "north-central",
    name: "North Central",
    fullName: "North Central College",
    nickname: "Cardinals",
    primary: "#c8102e",
    secondary: "#1c1c1c",
    abbr: "NCC",
    location: "Naperville, IL",
    venue: "Benedetti-Wehrli Stadium",
  },
  {
    slug: "north-park",
    name: "North Park",
    fullName: "North Park University",
    nickname: "Vikings",
    primary: "#00447c",
    secondary: "#f2a900",
    abbr: "NPU",
    location: "Chicago, IL",
    venue: "Holmgren Athletic Complex",
  },
  {
    slug: "wheaton",
    name: "Wheaton",
    fullName: "Wheaton College",
    nickname: "Thunder",
    primary: "#0b3d91",
    secondary: "#e35205",
    abbr: "WHE",
    location: "Wheaton, IL",
    venue: "Joe Bean Stadium",
  },
];

/** Non-conference opponents that appear in the schedule but not the table. */
export const nonConferenceTeams: Team[] = [
  {
    slug: "uw-whitewater",
    name: "UW-Whitewater",
    fullName: "University of Wisconsin-Whitewater",
    nickname: "Warhawks",
    primary: "#4b2e83",
    secondary: "#ffffff",
    abbr: "UWW",
    location: "Whitewater, WI",
    venue: "Fiskum Field",
  },
  {
    slug: "loras",
    name: "Loras",
    fullName: "Loras College",
    nickname: "Duhawks",
    primary: "#4b2e83",
    secondary: "#f2a900",
    abbr: "LOR",
    location: "Dubuque, IA",
    venue: "Rock Bowl",
  },
  {
    slug: "calvin",
    name: "Calvin",
    fullName: "Calvin University",
    nickname: "Knights",
    primary: "#8c2332",
    secondary: "#f2a900",
    abbr: "CAL",
    location: "Grand Rapids, MI",
    venue: "Zuidema Field",
  },
  {
    slug: "washu",
    name: "Washington U.",
    fullName: "Washington University in St. Louis",
    nickname: "Bears",
    primary: "#a51417",
    secondary: "#215732",
    abbr: "WSH",
    location: "St. Louis, MO",
    venue: "Francis Olympic Field",
  },
];

export const allTeams: Team[] = [...teams, ...nonConferenceTeams];

export const conferenceSlugs = new Set(teams.map((t) => t.slug));
