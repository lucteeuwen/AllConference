-- Plays recorded while a match is on, from the host's SIDEARM Stats feed. Until
-- now match_events only held what the final box score lists (goals and cards).
-- The feed also has substitutions, shots, fouls, corners and free kicks, and a
-- stable id per play, which keeps a poll from inserting the same play twice.

alter table public.match_events drop constraint if exists match_events_type_check;
alter table public.match_events
  add constraint match_events_type_check
  check (type in ('goal', 'own-goal', 'penalty', 'yellow', 'red', 'sub', 'shot', 'foul', 'corner', 'freekick', 'period'));

alter table public.match_events
  -- The feed's id for the play; null for rows read from a box score.
  add column if not exists source_id text,
  -- A few words the type does not carry: "for J. Smith", "saved", "Half time".
  add column if not exists detail text,
  -- True once the play has been added to the player's season totals, so a
  -- later box score can correct them instead of adding the goal a second time.
  add column if not exists counted boolean not null default false;

-- Not partial, so an upsert can name it as its conflict target. Rows from a box
-- score have no source_id, and nulls never collide in a unique index.
create unique index if not exists match_events_source_idx
  on public.match_events (match_id, source_id);

-- Adds a live play to a player's season totals in one statement, so two polls
-- cannot overwrite each other's count. Totals never go below zero.
create or replace function public.bump_player_stats(
  p_id text,
  p_goals integer default 0,
  p_assists integer default 0,
  p_yellow integer default 0,
  p_red integer default 0,
  p_pk integer default 0
) returns void
language sql
as $$
  update public.players
     set goals = greatest(0, goals + p_goals),
         assists = greatest(0, assists + p_assists),
         yellow_cards = greatest(0, coalesce(yellow_cards, 0) + p_yellow),
         red_cards = greatest(0, coalesce(red_cards, 0) + p_red),
         pk_goals = greatest(0, coalesce(pk_goals, 0) + p_pk),
         updated_at = now()
   where id = p_id;
$$;

-- The site reads with the anon key and must stay read-only; only the scraper's
-- service role may call this.
revoke all on function public.bump_player_stats(text, integer, integer, integer, integer, integer)
  from public, anon, authenticated;
