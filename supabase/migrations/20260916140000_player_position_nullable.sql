-- Some schools leave the position column blank on their rosters.
alter table public.players alter column position drop not null;
alter table public.players alter column position drop default;
