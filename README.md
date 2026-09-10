# CCIW Men's Soccer

Front end for an NCAA Division III College Conference of Illinois and Wisconsin
men's soccer site: results, fixtures, standings and rosters.

The backend scraper does not exist yet. Every page reads generated fixture data
shaped exactly like the scraper's eventual output, so wiring up real data is a
change to `lib/data/` and nothing else.

```bash
npm run dev
```

## Routes

| Route | What it shows |
| --- | --- |
| `/matches` | Date rail, filters, matches grouped by day, live hero card. `/` redirects here. |
| `/matches/[id]` | Score header with Details, Lineups and Standings tabs. |
| `/standings` | Conference table with All / Home / Away splits and column sorting. |
| `/teams` | The nine conference members with their conference record. |
| `/teams/[slug]` | Team header, season record, Roster and Schedule tabs. |

Filter and tab state lives in the URL, so every view is linkable and survives a
reload.

## Replacing the dummy data

`lib/types.ts` is the contract. The scraper needs to produce three collections:

- `Team[]` — one entry per school, including the colour used for its badge.
- `Match[]` — kickoff as an ISO instant, status, both sides' scores, plus
  optional events and lineups.
- `Player[]` — rosters keyed by team.

Then swap the three modules in `lib/data/` for real fetches. `lib/selectors.ts`
is the only read path the pages use, and `computeStandings` there derives the
table from finished matches rather than storing it, so the table stays
consistent with whatever fixtures the scraper returns.

Two things to undo when real data arrives:

- `lib/data/season.ts` builds kickoff times relative to today so the demo always
  has results behind it and fixtures ahead.
- `/standings` and `/teams` set `dynamic = "force-dynamic"` for the same reason.

## Design

NCAA navy (`--color-navy`) carries the headers, with indigo (`--color-accent`)
for buttons, active tabs and the live card. Tokens are defined once in
`app/globals.css` under Tailwind's `@theme`.

School crests are licensed assets, so `TeamBadge` draws a coloured circle with
the school's abbreviation instead. Team colours in `lib/data/teams.ts` are
placeholders and should be checked against each school's athletics site.

Layout is mobile first: a fixed bottom tab bar on phones that becomes a top bar
from the `md` breakpoint up.
