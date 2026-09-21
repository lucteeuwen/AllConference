-- Estimated instant play began. Set by the live scraper (first seen live, then
-- re-anchored from goal minutes) so the site's match clock can correct itself.
alter table public.matches add column if not exists started_at timestamptz;
