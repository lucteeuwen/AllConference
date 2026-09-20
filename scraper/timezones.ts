/**
 * Where a game is actually played. The SIDEARM feeds give a location as a city
 * and an AP-style state ("Chicago, Ill."), which is all we have to place a
 * non-conference ground with, so this resolves that string to an IANA zone.
 *
 * Returning null is a real answer: it means "we cannot place this", and the
 * caller falls back to the home team's own zone rather than guessing.
 */

const EASTERN = "America/New_York";
const CENTRAL = "America/Chicago";
const MOUNTAIN = "America/Denver";
const PACIFIC = "America/Los_Angeles";

/**
 * Each state's zone by where most of its people live. Split states are
 * corrected by CITY_ZONE below. Keyed by AP abbreviation and USPS code, both
 * reduced to letters only ("Ill." and "IL" both key on "ill"/"il").
 */
const STATE_ZONE: Record<string, string> = {
  // Eastern
  conn: EASTERN, ct: EASTERN, del: EASTERN, de: EASTERN, dc: EASTERN,
  fla: EASTERN, fl: EASTERN, ga: EASTERN, maine: EASTERN, me: EASTERN,
  md: EASTERN, mass: EASTERN, ma: EASTERN, nh: EASTERN, nj: EASTERN,
  ny: EASTERN, nc: EASTERN, ohio: EASTERN, oh: EASTERN, pa: EASTERN,
  ri: EASTERN, sc: EASTERN, vt: EASTERN, va: EASTERN, wva: EASTERN, wv: EASTERN,
  // Eastern, but with their own zone id for historic DST rules.
  mich: "America/Detroit", mi: "America/Detroit",
  ind: "America/Indiana/Indianapolis", in: "America/Indiana/Indianapolis",
  ky: EASTERN, // Louisville and Lexington outweigh the western half.
  // Central
  ala: CENTRAL, al: CENTRAL, ark: CENTRAL, ar: CENTRAL, ill: CENTRAL, il: CENTRAL,
  iowa: CENTRAL, ia: CENTRAL, kan: CENTRAL, ks: CENTRAL, la: CENTRAL,
  minn: CENTRAL, mn: CENTRAL, miss: CENTRAL, ms: CENTRAL, mo: CENTRAL,
  neb: CENTRAL, ne: CENTRAL, nd: CENTRAL, okla: CENTRAL, ok: CENTRAL,
  sd: CENTRAL, tenn: CENTRAL, tn: CENTRAL, texas: CENTRAL, tx: CENTRAL,
  wis: CENTRAL, wi: CENTRAL,
  // Mountain
  colo: MOUNTAIN, co: MOUNTAIN, idaho: MOUNTAIN, id: MOUNTAIN,
  mont: MOUNTAIN, mt: MOUNTAIN, nm: MOUNTAIN, utah: MOUNTAIN, ut: MOUNTAIN,
  wyo: MOUNTAIN, wy: MOUNTAIN,
  ariz: "America/Phoenix", az: "America/Phoenix",
  // Pacific and beyond
  calif: PACIFIC, ca: PACIFIC, nev: PACIFIC, nv: PACIFIC,
  ore: PACIFIC, or: PACIFIC, wash: PACIFIC, wa: PACIFIC,
  alaska: "America/Anchorage", ak: "America/Anchorage",
  hawaii: "Pacific/Honolulu", hi: "Pacific/Honolulu",
};

/**
 * Cities that sit in the minority zone of a split state. Only the ones a CCIW
 * side could plausibly travel to are listed; anything missing falls back to the
 * state's dominant zone, and the caller warns so this table can grow from real
 * fixtures rather than guesses.
 */
const CITY_ZONE: Record<string, string> = {
  // North-west and south-west Indiana keep Chicago's clock.
  "hammond|ind": CENTRAL, "whiting|ind": CENTRAL, "gary|ind": CENTRAL,
  "east chicago|ind": CENTRAL, "munster|ind": CENTRAL, "crown point|ind": CENTRAL,
  "merrillville|ind": CENTRAL, "valparaiso|ind": CENTRAL, "michigan city|ind": CENTRAL,
  "la porte|ind": CENTRAL, "laporte|ind": CENTRAL, "rensselaer|ind": CENTRAL,
  "evansville|ind": CENTRAL, "vincennes|ind": CENTRAL, "jasper|ind": CENTRAL,
  // The western Upper Peninsula keeps Chicago's clock.
  "menominee|mich": CENTRAL, "iron mountain|mich": CENTRAL, "ironwood|mich": CENTRAL,
  // Western Kentucky is Central; the state defaults to Eastern.
  "bowling green|ky": CENTRAL, "owensboro|ky": CENTRAL, "paducah|ky": CENTRAL,
  "hopkinsville|ky": CENTRAL,
  // Eastern Tennessee; the state defaults to Central.
  "knoxville|tenn": EASTERN, "chattanooga|tenn": EASTERN, "johnson city|tenn": EASTERN,
  "kingsport|tenn": EASTERN, "bristol|tenn": EASTERN, "maryville|tenn": EASTERN,
  "cleveland|tenn": EASTERN,
  // The Florida panhandle is Central.
  "pensacola|fla": CENTRAL, "panama city|fla": CENTRAL, "fort walton beach|fla": CENTRAL,
  // Odds and ends.
  "el paso|texas": MOUNTAIN,
  "scottsbluff|neb": MOUNTAIN, "chadron|neb": MOUNTAIN,
  "rapid city|sd": MOUNTAIN, "spearfish|sd": MOUNTAIN,
  "coeur d alene|idaho": PACIFIC, "moscow|idaho": PACIFIC, "lewiston|idaho": PACIFIC,
};

/** Letters only, so "Ill.", "ill" and "IL " all key the same way. */
function key(value: string): string {
  return value.toLowerCase().replace(/[^a-z]+/g, "");
}

/** A city key keeps word breaks so "east chicago" stays two words. */
function cityKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z]+/g, " ").trim();
}

/** Guards against a typo in the tables ever reaching the database. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** True when the state has counties in more than one zone, so a miss is worth a warning. */
export function isSplitZoneState(location: string): boolean {
  const state = key(location.split(",").pop() ?? "");
  return ["ind", "in", "mich", "mi", "ky", "tenn", "tn", "fla", "fl", "texas", "tx",
    "kan", "ks", "neb", "ne", "nd", "sd", "ore", "or", "idaho", "id"].includes(state);
}

/**
 * IANA zone for a "City, St." location, or null when the state is unrecognised.
 * A bare "TBA", "Home" or an empty string reads as unknown.
 */
export function zoneForLocation(location: string): string | null {
  const parts = location.split(",");
  if (parts.length < 2) return null;

  const state = key(parts[parts.length - 1]);
  const city = cityKey(parts.slice(0, -1).join(" "));

  const zone = CITY_ZONE[`${city}|${state}`] ?? STATE_ZONE[state] ?? null;
  return zone && isValidTimeZone(zone) ? zone : null;
}
