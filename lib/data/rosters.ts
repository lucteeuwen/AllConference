import { createRng } from "@/lib/rng";
import { allTeams } from "@/lib/data/teams";
import type { ClassYear, Player, Position } from "@/lib/types";

/**
 * Rosters are generated from name pools with a per-team seed. Hand-typing ~280
 * players would bury the interesting data, and the generated version is stable
 * across reloads because the seed is the team slug.
 */

const firstNames = [
  "Aiden", "Alex", "Andres", "Anthony", "Ben", "Blake", "Brady", "Caleb",
  "Cameron", "Carter", "Charlie", "Colin", "Connor", "Cooper", "Daniel",
  "David", "Declan", "Diego", "Dominic", "Elliot", "Ethan", "Evan", "Felix",
  "Finn", "Gabriel", "Grant", "Griffin", "Harrison", "Henry", "Hugo", "Ian",
  "Isaac", "Jack", "Jacob", "Jaden", "James", "Jonah", "Jordan", "Joseph",
  "Josh", "Julian", "Kai", "Kevin", "Liam", "Logan", "Lucas", "Luke", "Malik",
  "Marco", "Mason", "Mateo", "Matthew", "Max", "Micah", "Nathan", "Nico",
  "Noah", "Oliver", "Omar", "Owen", "Parker", "Patrick", "Quinn", "Reid",
  "Riley", "Ryan", "Sam", "Sebastian", "Simon", "Tanner", "Theo", "Thomas",
  "Tobias", "Trevor", "Tyler", "Victor", "Vincent", "Wesley", "Will", "Zane",
];

const lastNames = [
  "Alvarez", "Andersen", "Bauer", "Becker", "Bergstrom", "Blake", "Boyd",
  "Brennan", "Burke", "Callahan", "Carlson", "Castillo", "Chen", "Clarke",
  "Coleman", "Cruz", "Dahl", "Delgado", "Donnelly", "Dvorak", "Ellis",
  "Engstrom", "Fischer", "Fitzgerald", "Fuentes", "Gallagher", "Garcia",
  "Gustafson", "Hansen", "Hartman", "Hayes", "Herrera", "Hoffman", "Holloway",
  "Hughes", "Iverson", "Jensen", "Kaminski", "Keller", "Kowalski", "Lindgren",
  "Lombardi", "Lopez", "Lund", "Maddox", "Mahoney", "Marquez", "McCarthy",
  "Mercado", "Molina", "Moreno", "Novak", "Nowak", "O'Brien", "Okafor",
  "Olsen", "Ortega", "Palmer", "Pedersen", "Petrov", "Quintero", "Ramirez",
  "Reyes", "Rhodes", "Riley", "Rivera", "Rasmussen", "Salazar", "Sandoval",
  "Schmidt", "Schneider", "Sorensen", "Stafford", "Sullivan", "Swanson",
  "Thorne", "Vargas", "Walsh", "Weber", "Whitaker", "Zielinski",
];

const hometowns = [
  "Naperville, IL", "Chicago, IL", "Oak Park, IL", "Evanston, IL",
  "Arlington Heights, IL", "Schaumburg, IL", "Rockford, IL", "Peoria, IL",
  "Springfield, IL", "Champaign, IL", "Bloomington, IL", "Wheaton, IL",
  "Aurora, IL", "Elgin, IL", "Milwaukee, WI", "Madison, WI", "Waukesha, WI",
  "Kenosha, WI", "Racine, WI", "Green Bay, WI", "Appleton, WI", "Brookfield, WI",
  "St. Louis, MO", "Kansas City, MO", "Indianapolis, IN", "Fort Wayne, IN",
  "Grand Rapids, MI", "Ann Arbor, MI", "Des Moines, IA", "Cedar Rapids, IA",
  "Minneapolis, MN", "St. Paul, MN", "Columbus, OH", "Cincinnati, OH",
  "Louisville, KY", "Nashville, TN", "Denver, CO", "Phoenix, AZ",
];

const years: ClassYear[] = ["Fr.", "So.", "Jr.", "Sr."];

/** 22-man roster: 3 keepers, 7 defenders, 7 midfielders, 5 forwards. */
const positionPlan: Position[] = [
  ...Array<Position>(3).fill("GK"),
  ...Array<Position>(7).fill("D"),
  ...Array<Position>(7).fill("M"),
  ...Array<Position>(5).fill("F"),
];

function buildRoster(teamSlug: string): Player[] {
  const rng = createRng(`roster:${teamSlug}`);
  const usedNames = new Set<string>();
  const numbers = rng.shuffle(Array.from({ length: 30 }, (_, i) => i + 1));

  return positionPlan.map((position, index) => {
    let name = "";
    do {
      name = `${rng.pick(firstNames)} ${rng.pick(lastNames)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    // Keepers wear low numbers, everyone else takes from the shuffled pool.
    const number = position === "GK" ? [1, 0, 30][index] : numbers[index];
    const year = rng.pick(years);
    const gp = rng.int(4, 14);

    const scoringWeight = position === "F" ? 1 : position === "M" ? 0.55 : position === "D" ? 0.15 : 0;
    const goals = Math.round(rng.int(0, 9) * scoringWeight);
    const assists = Math.round(rng.int(0, 7) * (scoringWeight * 0.8 + 0.1));

    return {
      id: `${teamSlug}-${index + 1}`,
      teamSlug,
      number,
      name,
      position,
      year,
      hometown: rng.pick(hometowns),
      height: `${rng.int(5, 6)}-${rng.int(0, 11)}`,
      stats: { gp, gs: Math.max(0, gp - rng.int(0, 6)), goals, assists },
    };
  });
}

export const rosters: Record<string, Player[]> = Object.fromEntries(
  allTeams.map((team) => [team.slug, buildRoster(team.slug)]),
);

export const playersById: Record<string, Player> = Object.fromEntries(
  Object.values(rosters)
    .flat()
    .map((player) => [player.id, player]),
);
