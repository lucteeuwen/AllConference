-- SIDEARM numbers sports per site; men's soccer ids read from each schedule
-- page on 2026-09-16. The scraper rediscovers any id left null.
update public.teams as t
set sidearm_sport_id = v.sport_id
from (values
  ('augustana', 8),
  ('carroll', 8),
  ('carthage', 8),
  ('elmhurst', 7),
  ('illinois-wesleyan', 7),
  ('millikin', 8),
  ('north-central', 6),
  ('north-park', 7),
  ('wheaton', 18)
) as v(slug, sport_id)
where t.slug = v.slug;
