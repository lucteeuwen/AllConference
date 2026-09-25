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

Schools usually paste only their team page on the network into SIDEARM, so the
full scrape also reads the network's own broadcast list (Hudl vCloud's public
`/api/viewer/broadcast`, men's soccer section, the nine school sites in
`scraper/config.ts`) and links each game to its exact broadcast
(`cciwnetwork.com/<school>/?B=<id>`, stored in `matches.broadcast_url`). A
broadcast counts when it is within 12 hours of kickoff and names both schools
(the host may be implied by the site it is on); clips such as postgame
interviews are ignored. The site shows `broadcast_url` first and falls back to
the school's link (`video_url`) when there is none, e.g. games hosted by
non-CCIW schools. If the network can't be read, stored links are left alone.

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
| `npm run scrape` | One full scrape pass; if a match is on, then polls just that match every minute for up to 9 min |
| `npm run scrape -- --auto` | What the workflow runs every 5 min: a full pass if the last is over 14 min old, else live mode only |
| `npm run scrape -- --live-only` | Live mode alone; exits within seconds when nothing is on |
| `npm run scrape -- --rosters` | Also refreshes rosters and season stats |
| `npm run scrape -- --dry-run [--json]` | Reads the feeds and prints what would be written |
| `npm run scrape -- --no-live` | Skips live mode |
| `npm test` | Parser tests against saved SIDEARM pages in `scraper/__tests__/fixtures` |
| `npm run db:push` | Applies new migrations to the linked Supabase project |

`.github/workflows/scrape.yml` runs the scraper with `--auto` every 5 minutes
from August to November, and with `--rosters` once a day. It needs the
repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

GitHub's native `schedule:` trigger is unreliable below ~15 minutes on public
repos (observed gaps of hours instead of 5 minutes), so the real 5-minute tick
is driven by an external cron service (e.g. cron-job.org) calling
`POST /repos/lucteeuwen/AllConference/actions/workflows/scrape.yml/dispatches`
with `{"ref":"main","inputs":{"auto":"true"}}` and a repo-scoped PAT
(`Actions: Read and write`). The native `schedule:` entries stay in the
workflow as a harmless backstop.

**Live mode** covers a match from 15 minutes before kickoff until its box score
is read, or 150 minutes after kickoff. Each minute it re-reads only the feeds of
the schools in that match and its box score, and writes only the columns a game
changes (status, score, `finished_at`, `started_at`); the season, bracket, logos
and rosters are left to the full pass. The site does not wait for the scraper to
show a match as live: from kickoff it counts the minute up itself, and once a
match should be over it shows "Full time" until the final score arrives.
`started_at` is the scraper's estimate of when play began, set when it first sees
the game in play near kickoff and re-anchored from each new goal's minute, and the
site's clock counts from it.

**How often is it scraping?**

- GitHub → *Actions* → *Scrape CCIW data* lists every run with its start time and
  length, which shows how far GitHub's scheduler drifts from every 5 minutes.
- In Supabase, `scrape_runs` has one row per run (`full`, `full+rosters` or `live`;
  quiet 5-minute ticks with no match on write none). Its `log` shows which matches
  were polled and how many polls ran:
  `select started_at, finished_at, mode, ok, log from scrape_runs order by id desc limit 30;`
- `matches.updated_at` is when a match row last changed.

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
- Pages are cached for 30 seconds, and the match, matches, team and home pages
  refresh themselves every 30 seconds while a match is on. Data is only as fresh
  as the scraper: about 15 minutes normally, about a minute while a match is on.
- The `20260921120000_match_started_at` migration must be applied
  (`npm run db:push`) before the site that reads `started_at` is deployed.

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
cached for 30 seconds. `lib/selectors.ts` derives everything else, and
`lib/standings.ts` computes the table from finished matches (shared with the
scraper, which uses it to project seeds).

## Design

NCAA navy (`--color-navy`) carries the headers, with indigo (`--color-accent`)
for buttons, active tabs and the live card. Tokens are defined once in
`app/globals.css` under Tailwind's `@theme`.

Layout is mobile first: a fixed bottom tab bar on phones that becomes a top bar
from the `md` breakpoint up.
