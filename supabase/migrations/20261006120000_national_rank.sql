-- Current national (United Soccer Coaches NCAA DIII) ranking; null when unranked.
alter table teams add column if not exists national_rank int;
