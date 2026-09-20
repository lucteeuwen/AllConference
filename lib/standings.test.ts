import { describe, expect, it } from "vitest";
import { recordFor, sortEntries, type SortKey } from "@/lib/standings";
import type { RecordLine, Result, StandingsRow, StandingsSplit } from "@/lib/types";

const record = (w = 0, l = 0, d = 0, gf = 0, ga = 0): RecordLine => ({
  w,
  l,
  d,
  gf,
  ga,
  pts: w * 3 + d,
});

type Entry = { row: StandingsRow; name: string };

function entry(
  name: string,
  parts: { conference?: RecordLine; overall?: RecordLine; home?: RecordLine; away?: RecordLine; form?: Result[] },
): Entry {
  return {
    name,
    row: {
      teamSlug: name,
      conference: parts.conference ?? record(),
      overall: parts.overall ?? record(),
      home: parts.home ?? record(),
      away: parts.away ?? record(),
      form: parts.form ?? [],
    },
  };
}

const names = (entries: Entry[]) => entries.map((item) => item.name).join(",");
const order = (
  entries: Entry[],
  sort: SortKey,
  split: StandingsSplit = "all",
  started = true,
) => names(sortEntries(entries, sort, split, started));

describe("recordFor", () => {
  const row = entry("a", {
    conference: record(1),
    overall: record(2),
    home: record(3),
    away: record(4),
  }).row;

  it("shows the conference record for All once conference play has started", () => {
    expect(recordFor(row, "all", true).w).toBe(1);
  });

  it("shows every game for All before conference play, so there is something to sort", () => {
    expect(recordFor(row, "all", false).w).toBe(2);
  });

  it("uses the home and away records whatever the state of the conference", () => {
    expect(recordFor(row, "home", true).w).toBe(3);
    expect(recordFor(row, "away", false).w).toBe(4);
  });
});

describe("sortEntries", () => {
  // Incoming order is the standing: a, b, c.
  const a = entry("a", { conference: record(1, 2, 0, 3, 9), overall: record(1, 2, 0, 3, 9) });
  const b = entry("b", { conference: record(3, 0, 1, 8, 2), overall: record(3, 0, 1, 8, 2) });
  const c = entry("c", { conference: record(2, 1, 0, 5, 4), overall: record(2, 1, 0, 5, 4) });
  const table = [a, b, c];

  it("keeps the incoming order for the standing", () => {
    expect(order(table, "rank")).toBe("a,b,c");
  });

  it("puts the highest first for points, wins, draws, goals for and goal difference", () => {
    expect(order(table, "pts")).toBe("b,c,a");
    expect(order(table, "w")).toBe("b,c,a");
    expect(order(table, "d")).toBe("b,a,c");
    expect(order(table, "gf")).toBe("b,c,a");
    expect(order(table, "gd")).toBe("b,c,a");
  });

  it("puts the fewest first for losses and goals against", () => {
    expect(order(table, "l")).toBe("b,c,a");
    expect(order(table, "ga")).toBe("b,c,a");
    // A different shape, so the ascending order is not a coincidence of the fixture.
    const x = entry("x", { conference: record(0, 0, 0, 0, 5) });
    const y = entry("y", { conference: record(0, 0, 0, 0, 1) });
    expect(order([x, y], "ga")).toBe("y,x");
    expect(order([x, y], "l")).toBe("x,y");
  });

  it("breaks ties by the incoming order, in both directions", () => {
    const p = entry("p", { conference: record(2, 1) });
    const q = entry("q", { conference: record(2, 1) });
    expect(order([p, q], "w")).toBe("p,q");
    expect(order([q, p], "w")).toBe("q,p");
    expect(order([p, q], "l")).toBe("p,q");
    expect(order([q, p], "ga")).toBe("q,p");
  });

  it("does not modify its input", () => {
    const copy = [...table];
    sortEntries(table, "pts", "all", true);
    expect(table).toEqual(copy);
  });

  it("sorts on the overall record in All before conference play, when conference records are all zero", () => {
    const early = [
      entry("a", { overall: record(0, 1, 0, 0, 1) }),
      entry("b", { overall: record(2, 0, 0, 5, 0) }),
      entry("c", { overall: record(1, 0, 1, 2, 1) }),
    ];
    expect(order(early, "gf", "all", false)).toBe("b,c,a");
    expect(order(early, "w", "all", false)).toBe("b,c,a");
    expect(order(early, "gd", "all", false)).toBe("b,c,a");
    // Fewest goals against first; a and c tie on 1, so they keep their incoming order.
    expect(order(early, "ga", "all", false)).toBe("b,a,c");
    // With the conference started those same all-zero conference records tie, as they should.
    expect(order(early, "gf", "all", true)).toBe("a,b,c");
  });

  it("sorts Home and Away on their own records", () => {
    const rows = [
      entry("a", { home: record(3), away: record(0) }),
      entry("b", { home: record(1), away: record(2) }),
      entry("c", { home: record(2), away: record(1) }),
    ];
    expect(order(rows, "w", "home")).toBe("a,c,b");
    expect(order(rows, "w", "away")).toBe("b,c,a");
  });

  it("sorts by form regardless of the split, best form first", () => {
    const rows = [
      entry("a", { form: ["L", "L", "D"] }),
      entry("b", { form: ["W", "W", "W"] }),
      entry("c", { form: ["W", "D", "L"] }),
    ];
    expect(order(rows, "form", "all")).toBe("b,c,a");
    expect(order(rows, "form", "home")).toBe("b,c,a");
    expect(order(rows, "form", "away", false)).toBe("b,c,a");
  });
});
