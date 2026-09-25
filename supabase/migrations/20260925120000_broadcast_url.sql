-- The game's own CCIW Network broadcast (cciwnetwork.com/<school>/?B=<id>),
-- found by the scraper from the network's broadcast list. The school's own link
-- stays in video_url as the fallback.
alter table public.matches add column if not exists broadcast_url text;
