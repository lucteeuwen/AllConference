-- Core schema for the CCIW men's soccer site. The scraper (service role) is the
-- only writer; the site reads with the anon key, so every table gets a
-- read-only policy for anon and nothing else.

create table public.teams (
  slug text primary key,
  name text not null,
  full_name text not null,
  nickname text not null default '',
  abbr text not null,
  primary_color text not null default '#6b7280',
  secondary_color text not null default '#ffffff',
  location text not null default '',
  venue text not null default '',
  is_conference boolean not null default false,
  sidearm_base_url text,
  sidearm_sport_id integer,
  -- Every spelling the SIDEARM feeds use for this school, e.g.
  -- "Wheaton College (Ill.)" or "Augustana College (IL)".
  aliases text[] not null default '{}',
  logo_url text,
  logo_source_url text,
  updated_at timestamptz not null default now()
);

create table public.matches (
  id text primary key,
  season integer not null,
  date timestamptz not null,
  -- Set the first time the scraper sees the match as final. Drives how long the
  -- home page keeps the match box up after full time.
  finished_at timestamptz,
  status text not null check (status in ('scheduled', 'live', 'final', 'postponed', 'canceled')),
  minute integer,
  -- Null means the side is not known yet (tournament games): shown as TBC.
  home_slug text references public.teams (slug),
  away_slug text references public.teams (slug),
  home_placeholder text,
  away_placeholder text,
  home_score integer,
  away_score integer,
  home_pens integer,
  away_pens integer,
  venue text not null default '',
  is_conference boolean not null default false,
  stage text not null default 'regular'
    check (stage in ('regular', 'quarterfinal', 'semifinal', 'final', 'ncaa')),
  bracket_slot text,
  attendance integer,
  referee text,
  video_url text,
  boxscore_url text,
  recap_url text,
  source_school text references public.teams (slug),
  source_game_id integer,
  events_scraped boolean not null default false,
  updated_at timestamptz not null default now()
);

create index matches_season_date_idx on public.matches (season, date);

create table public.match_events (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches (id) on delete cascade,
  sort integer not null,
  minute integer not null,
  type text not null check (type in ('goal', 'own-goal', 'penalty', 'yellow', 'red')),
  team_slug text references public.teams (slug),
  player_name text not null,
  player_id text,
  assist_name text,
  assist_player_id text
);

create index match_events_match_idx on public.match_events (match_id);

create table public.match_lineups (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches (id) on delete cascade,
  team_slug text references public.teams (slug),
  side text not null check (side in ('home', 'away')),
  sort integer not null,
  starter boolean not null,
  number integer,
  player_name text not null,
  position text,
  player_id text
);

create index match_lineups_match_idx on public.match_lineups (match_id);

create table public.players (
  id text primary key,
  season integer not null,
  team_slug text not null references public.teams (slug),
  sidearm_id integer,
  number integer,
  name text not null,
  position text not null default 'M',
  year text not null default '',
  hometown text not null default '',
  height text not null default '',
  gp integer not null default 0,
  gs integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  updated_at timestamptz not null default now()
);

create index players_team_idx on public.players (season, team_slug);

create table public.bracket_seeds (
  season integer not null,
  seed integer not null check (seed between 1 and 6),
  team_slug text not null references public.teams (slug),
  -- False while the seeds are projected from the live table. Set to true by
  -- hand (or by the scraper) once the conference publishes the field.
  is_official boolean not null default false,
  primary key (season, seed)
);

create table public.bracket_slots (
  season integer not null,
  slot text not null check (slot in ('qf1', 'qf2', 'sf1', 'sf2', 'final')),
  round text not null check (round in ('quarterfinal', 'semifinal', 'final')),
  -- A slot side is either a fixed seed or the winner of an earlier slot.
  home_seed integer,
  away_seed integer,
  home_from text,
  away_from text,
  match_id text references public.matches (id) on delete set null,
  primary key (season, slot)
);

create table public.scrape_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  mode text not null,
  ok boolean,
  log jsonb not null default '[]'
);

-- Read-only public access.
do $$
declare
  t text;
begin
  foreach t in array array['teams', 'matches', 'match_events', 'match_lineups', 'players', 'bracket_seeds', 'bracket_slots']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end
$$;

-- Run logs stay private to the service role.
alter table public.scrape_runs enable row level security;

-- Logos are downloaded once by the scraper and served from here.
insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;
