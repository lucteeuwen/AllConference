-- Kickoffs are shown in the reader's own time zone, which breaks two things
-- that quietly relied on the site rendering everything in Central.

-- 1. "Time to be announced" used to be inferred from the clock reading 00:00 in
--    Central. Read in any other zone that test means nothing, so store the flag
--    the scraper already computes.
-- 2. Nothing recorded where a match is played, so there was no way to tell a
--    reader what time it kicks off at the ground.
alter table public.matches
  add column time_tbd boolean not null default false,
  -- IANA zone of this game's venue. Null means "the home team's zone"; only
  -- neutral sites and away grounds we could place set it explicitly.
  add column timezone text;

alter table public.teams
  -- IANA zone of the school's own ground. Null for opponents we cannot place:
  -- a default would make every auto-created non-conference team claim Central.
  add column timezone text;

-- The nine members are all Illinois or Wisconsin.
update public.teams set timezone = 'America/Chicago' where is_conference;

-- Read the old "Central midnight" rule one last time, then retire it.
update public.matches
   set time_tbd = true
 where to_char(date at time zone 'America/Chicago', 'HH24:MI') = '00:00';

-- Re-anchor those kickoffs from venue midnight to venue noon. Midnight sits
-- hours from a date boundary, so a match with no time yet lands on the wrong
-- calendar day for any reader west of the venue; noon is at least 12 hours from
-- either edge. The match id embeds the Central day, which noon does not move.
update public.matches
   set date = ((date at time zone 'America/Chicago')::date + time '12:00')
                at time zone 'America/Chicago'
 where time_tbd;
