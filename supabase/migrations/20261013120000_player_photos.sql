-- Headshots are downloaded once by the scraper and served from here.
-- `photo_url` is now the copy in this bucket; `photo_source_url` is the
-- school's URL it was copied from, so a changed photo is fetched again.
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

alter table public.players
  add column if not exists photo_source_url text;
