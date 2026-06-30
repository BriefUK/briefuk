-- Adds a word_count column to stories, populated going forward by
-- api/cron-fetch.js. Backfills existing rows from their current brief so
-- nothing shows a blank badge after this migration runs.
alter table stories add column if not exists word_count integer;

update stories
set word_count = array_length(regexp_split_to_array(trim(brief), '\s+'), 1)
where word_count is null and brief is not null and trim(brief) <> '';
