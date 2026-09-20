# CCIW Men's Soccer

Results, fixtures, standings, the CCIW Tournament bracket and rosters for NCAA
Division III College Conference of Illinois and Wisconsin men's soccer.

```
SIDEARM sites ──▶ scraper (GitHub Actions) ──▶ Supabase ──▶ Next.js site
```

## Where the data comes from

All nine CCIW schools (and cciw.org) run their athletics sites on SIDEARM
Sports. The scraper in `scraper/` reads, for each school:

| Source | What it gives |
| --- | --- |
| `/services/adaptive_components.ashx?type=scoreboard&sport_id=…` | The season schedule as JSON: kickoff, home/away, score, tournament, box score link, stream link |
| `/boxscore.aspx?id=…` | Goals and assists, cards, starting lineups, attendance, referee, stadium |
| `/sports/mens-soccer/roster/<season>?view=2` | Roster: number, position, class year, height, hometown |
| `/sports/mens-soccer/stats/<season>` | Season stats: games played and started, goals, assists |

A conference game appears in both schools' feeds; the two are merged into one
match, and the host's record wins for kickoff, score, box score and stream.

The scraper is polite on purpose: one request per second per site, a
descriptive User-Agent, box scores fetched once per game, rosters once a day.

### Tournament bracket

The CCIW Tournament is a six-team knockout. Seeds 1–6 come from the regular
season table, #3 v #6 and #4 v #5 play the quarterfinals, and #1 and #2 host the
semifinals. The schools publish placeholder games ("CCIW Tournament
Semifinal") before the field is set; those become **TBC** matches that fill in
as results arrive.

Seeds are projected from the live table until both real quarterfinals are
known. If the conference's tiebreakers ever disagree with the projection, set
the six rows in `bracket_seeds` by hand with `is_official = true` and the
scraper will use them.

### Video

Most home games stream on the CCIW Network (Hudl TV, subscription), some on
YouTube or FloCollege. The match page embeds a specific YouTube video and links
to everything else.

### Logos

Team logos are taken from the SIDEARM feeds, copied once into the public
`team-logos` Storage bucket, and re-downloaded only when a school changes its
logo. **Logos belong to their institutions; ask the schools for permission
before a public launch.** Teams without a logo get a coloured initials badge.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and keys
npx supabase login
npx supabase link --project-ref <ref>
npm run db:push              # applies supabase/migrations
npm run scrape -- --rosters  # first full import
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run scrape` | One scrape pass; stays up to 13 min polling every 2 min if a match is on |
| `npm run scrape -- --rosters` | Also refreshes rosters and season stats |
| `npm run scrape -- --dry-run [--json]` | Reads the feeds and prints what would be written |
| `npm run scrape -- --no-live` | Skips live mode |
| `npm test` | Parser tests against saved SIDEARM pages in `scraper/__tests__/fixtures` |
| `npm run db:push` | Applies new migrations to the linked Supabase project |

`.github/workflows/scrape.yml` runs the scraper every 15 minutes from August
to November, and with `--rosters` once a day. It needs the repository secrets
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Deploying

Everything runs on free tiers: Vercel Hobby (site), Supabase Free (database and
logos) and GitHub Actions (scraper; unlimited minutes on a public repo).

1. **Supabase**: `npm run db:push` applies the migrations to the linked project.
2. **GitHub**: add the repository secrets `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`, then run the *Scrape CCIW data* workflow once
   by hand with **rosters** ticked for the first import.
3. **Vercel**: import the repo, set the production branch to `main`, and add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Add them
   before the first build: the logo host in `next.config.ts` and the
   `NEXT_PUBLIC_*` values are read at build time. Do **not** add the service
   role key; the site never uses it.
4. **Analytics**: the site already includes Vercel Web Analytics and Speed
   Insights. Turn each on once under the project's **Analytics** and **Speed
   Insights** tabs in the Vercel dashboard, then redeploy. Neither needs env
   vars or a cookie banner, and they only report from the deployed site.

Things to know:

- Vercel Hobby is for non-commercial use only.
- `keepalive.yml` reads one row a week so Supabase doesn't pause the project
  between seasons. GitHub also turns off scheduled workflows in a public repo
  after 60 days without a commit; if that happens, re-enable them under
  Actions.
- Pages are cached for 60 seconds, but data is only as fresh as the scraper:
  about 15 minutes normally and 2 to 3 minutes while a match is on.

## Database

`supabase/migrations` holds the schema and the conference seed data (teams,
aliases, SIDEARM URLs, bracket layout). The site reads with the anon key, and
row-level security only allows `select`; the scraper writes with the service
role key.

| Table | Holds |
| --- | --- |
| `teams` | Conference members and every opponent seen in a feed |
| `matches` | One row per game, tournament TBC slots included |
| `match_events`, `match_lineups` | Box score timeline and lineups |
| `players` | Rosters with season stats |
| `bracket_seeds`, `bracket_slots` | Tournament seeding and layout |
| `scrape_runs` | A log line per scraper run |

## Routes

| Route | What it shows |
| --- | --- |
| `/` | Match box (15 min before kickoff until 15 min after full time), scoreboard, table, leaders, fixtures |
| `/matches` | Date rail, filters, matches grouped by day |
| `/matches/[id]` | Score header, video, details, timeline, lineups, standings |
| `/standings` | Conference table, tournament bracket, scoring leaders |
| `/teams` | The nine conference members with their conference record |
| `/teams/[slug]` | Team header, season record, roster and schedule |

`lib/season-data.ts` is the only module that talks to Supabase; reads are
cached for 60 seconds. `lib/selectors.ts` derives everything else, and
`lib/standings.ts` computes the table from finished matches (shared with the
scraper, which uses it to project seeds).

## Design

NCAA navy (`--color-navy`) carries the headers, with indigo (`--color-accent`)
for buttons, active tabs and the live card. Tokens are defined once in
`app/globals.css` under Tailwind's `@theme`.

Layout is mobile first: a fixed bottom tab bar on phones that becomes a top bar
from the `md` breakpoint up.
