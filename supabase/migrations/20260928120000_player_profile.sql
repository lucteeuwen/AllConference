-- Everything else a school's roster and season stats pages say about a
-- player, for the player page. All optional: rosters differ per school.
alter table public.players
  add column if not exists photo_url text,
  add column if not exists bio_url text,
  add column if not exists position_long text,
  add column if not exists weight text,
  add column if not exists high_school text,
  add column if not exists previous_school text,
  add column if not exists major text,
  add column if not exists captain boolean not null default false,
  -- Outfield season stats.
  add column if not exists minutes integer,
  add column if not exists shots integer,
  add column if not exists shots_on_goal integer,
  add column if not exists game_winners integer,
  add column if not exists pk_goals integer,
  add column if not exists pk_attempts integer,
  add column if not exists yellow_cards integer,
  add column if not exists red_cards integer,
  -- Goalkeeping season stats, for anyone who kept goal.
  add column if not exists gk_minutes integer,
  add column if not exists goals_against integer,
  add column if not exists saves integer,
  add column if not exists gk_wins integer,
  add column if not exists gk_losses integer,
  add column if not exists gk_ties integer,
  add column if not exists shutouts integer;
