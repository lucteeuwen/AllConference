-- Women's soccer next to men's. Schools (teams) are shared; everything played
-- or listed per sport carries a `sport`. Men's rows keep their ids, so every
-- existing /matches/<id> and /players/<id> link still resolves; women's ids
-- start with "w-" so a doubleheader (same day, same two schools) cannot collide.

alter table public.matches
  add column if not exists sport text not null default 'men' check (sport in ('men', 'women'));
alter table public.players
  add column if not exists sport text not null default 'men' check (sport in ('men', 'women'));
alter table public.bracket_slots
  add column if not exists sport text not null default 'men' check (sport in ('men', 'women'));
alter table public.bracket_seeds
  add column if not exists sport text not null default 'men' check (sport in ('men', 'women'));

create index if not exists matches_sport_season_date_idx on public.matches (sport, season, date);
create index if not exists players_sport_team_idx on public.players (sport, season, team_slug);

-- One bracket per sport per season.
alter table public.bracket_slots drop constraint bracket_slots_pkey;
alter table public.bracket_slots add primary key (sport, season, slot);
alter table public.bracket_seeds drop constraint bracket_seeds_pkey;
alter table public.bracket_seeds add primary key (sport, season, seed);

-- What a school is per sport: SIDEARM numbers each sport separately, and the
-- national polls are separate. Replaces teams.sidearm_sport_id and
-- teams.national_rank, which are left in place (unused) for now.
create table public.team_sports (
  team_slug text not null references public.teams (slug) on delete cascade,
  sport text not null check (sport in ('men', 'women')),
  sidearm_sport_id integer,
  -- Current United Soccer Coaches NCAA DIII rank; null when unranked.
  national_rank integer,
  primary key (team_slug, sport)
);

alter table public.team_sports enable row level security;
create policy "public read" on public.team_sports for select to anon, authenticated using (true);

insert into public.team_sports (team_slug, sport, sidearm_sport_id, national_rank)
select slug, 'men', sidearm_sport_id, national_rank
  from public.teams
 where sidearm_sport_id is not null or national_rank is not null;

-- Women's soccer ids, read from each schedule page and feed on 2026-10-13. The
-- scraper rediscovers any id left null.
insert into public.team_sports (team_slug, sport, sidearm_sport_id)
values
  ('augustana', 'women', 17),
  ('carroll', 'women', 17),
  ('carthage', 'women', 18),
  ('elmhurst', 'women', 14),
  ('illinois-wesleyan', 'women', 15),
  ('millikin', 'women', 15),
  ('north-central', 'women', 14),
  ('north-park', 'women', 14),
  ('wheaton', 'women', 19)
on conflict (team_slug, sport) do update set sidearm_sport_id = excluded.sidearm_sport_id;

-- The women's tournament uses the same six-team layout (the schools' feeds list
-- quarterfinals, semifinals and a final on the men's dates).
insert into public.bracket_slots (sport, season, slot, round, home_seed, away_seed, home_from, away_from)
values
  ('women', 2026, 'qf1', 'quarterfinal', 3, 6, null, null),
  ('women', 2026, 'qf2', 'quarterfinal', 4, 5, null, null),
  ('women', 2026, 'sf1', 'semifinal', 1, null, null, 'qf2'),
  ('women', 2026, 'sf2', 'semifinal', 2, null, null, 'qf1'),
  ('women', 2026, 'final', 'final', null, null, 'sf1', 'sf2')
on conflict do nothing;
