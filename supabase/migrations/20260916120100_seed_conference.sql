-- The nine CCIW members and the 2026 tournament layout. Kept as a migration
-- (not seed.sql) so `supabase db push` puts it in the hosted database too.
-- Colours are hand-picked badge fallbacks; logos are filled in by the scraper.

insert into public.teams
  (slug, name, full_name, nickname, abbr, primary_color, secondary_color, location, venue, is_conference, sidearm_base_url, aliases)
values
  ('augustana', 'Augustana', 'Augustana College', 'Vikings', 'AUG', '#003057', '#f2a900', 'Rock Island, IL', 'Thorson-Lucken Field', true,
    'https://athletics.augustana.edu',
    array['Augustana', 'Augustana College', 'Augustana College (IL)', 'Augustana College (Ill.)', 'Augustana (IL)', 'Augustana (Ill.)']),
  ('carroll', 'Carroll', 'Carroll University', 'Pioneers', 'CAR', '#e35205', '#1c1c1c', 'Waukesha, WI', 'Schneider Stadium', true,
    'https://gopios.com',
    array['Carroll', 'Carroll University', 'Carroll University (WI)', 'Carroll University (Wis.)', 'Carroll (WI)', 'Carroll (Wis.)']),
  ('carthage', 'Carthage', 'Carthage College', 'Firebirds', 'CTH', '#a6192e', '#ffffff', 'Kenosha, WI', 'Art Keller Field', true,
    'https://athletics.carthage.edu',
    array['Carthage', 'Carthage College']),
  ('elmhurst', 'Elmhurst', 'Elmhurst University', 'Bluejays', 'ELM', '#003da5', '#ffffff', 'Elmhurst, IL', 'Langhorst Field', true,
    'https://elmhurstbluejays.com',
    array['Elmhurst', 'Elmhurst University', 'Elmhurst College']),
  ('illinois-wesleyan', 'Illinois Wesleyan', 'Illinois Wesleyan University', 'Titans', 'IWU', '#00573f', '#ffffff', 'Bloomington, IL', 'Neis Field', true,
    'https://www.iwusports.com',
    array['Illinois Wesleyan', 'Illinois Wesleyan University', 'Ill. Wesleyan']),
  ('millikin', 'Millikin', 'Millikin University', 'Big Blue', 'MIL', '#00539b', '#ffffff', 'Decatur, IL', 'Frank M. Lindsay Field', true,
    'https://athletics.millikin.edu',
    array['Millikin', 'Millikin University']),
  ('north-central', 'North Central', 'North Central College', 'Cardinals', 'NCC', '#c8102e', '#1c1c1c', 'Naperville, IL', 'Benedetti-Wehrli Stadium', true,
    'https://northcentralcardinals.com',
    array['North Central', 'North Central College', 'North Central College (IL)', 'North Central College (Ill.)', 'North Central (IL)', 'North Central (Ill.)']),
  ('north-park', 'North Park', 'North Park University', 'Vikings', 'NPU', '#00447c', '#f2a900', 'Chicago, IL', 'Holmgren Athletic Complex', true,
    'https://athletics.northpark.edu',
    array['North Park', 'North Park University']),
  ('wheaton', 'Wheaton', 'Wheaton College', 'Thunder', 'WHE', '#0b3d91', '#e35205', 'Wheaton, IL', 'Joe Bean Stadium', true,
    'https://athletics.wheaton.edu',
    array['Wheaton', 'Wheaton College', 'Wheaton College (IL)', 'Wheaton College (Ill.)', 'Wheaton (IL)', 'Wheaton (Ill.)']);

-- Six-team bracket: #3 v #6 and #4 v #5 in the quarterfinals, #1 and #2 host
-- the semifinals, the higher remaining seed hosts the final.
insert into public.bracket_slots (season, slot, round, home_seed, away_seed, home_from, away_from)
values
  (2026, 'qf1', 'quarterfinal', 3, 6, null, null),
  (2026, 'qf2', 'quarterfinal', 4, 5, null, null),
  (2026, 'sf1', 'semifinal', 1, null, null, 'qf2'),
  (2026, 'sf2', 'semifinal', 2, null, null, 'qf1'),
  (2026, 'final', 'final', null, null, 'sf1', 'sf2');
