-- BriefUK core schema.
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- for a fresh project. Safe to re-run (uses IF NOT EXISTS / OR REPLACE).

create table if not exists stories (
  id           uuid primary key default gen_random_uuid(),
  url          text not null unique,
  title        text not null,
  brief        text,
  source       text not null,
  category     text not null,
  image_url    text,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists stories_category_idx on stories (category);
create index if not exists stories_published_at_idx on stories (published_at desc);

alter table stories enable row level security;

drop policy if exists "Public read access" on stories;
create policy "Public read access" on stories
  for select
  to anon, authenticated
  using (true);

-- No insert/update policy is created for anon/authenticated, so writes are
-- only possible via the service role key, which bypasses RLS entirely.

-- Tracks in-flight Anthropic Batch API jobs. A story is only written into
-- `stories` once its summary is ready, so `pending_stories` carries the full
-- story payload (not just URLs) needed to insert each row once the batch
-- completes. This also doubles as the in-flight dedup set: a cron run that
-- finds a URL already inside a pending batch must not resubmit it.
create table if not exists batches (
  id               text primary key, -- Anthropic batch id
  status           text not null default 'in_progress' check (status in ('in_progress', 'completed', 'failed')),
  pending_stories  jsonb not null, -- [{url,title,description,source,category,image_url,published_at}]
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table batches enable row level security;
-- No policies at all: anon/authenticated get zero access, only service role
-- (which bypasses RLS) can read or write — this table is cron-internal.

-- One row per weekly "The Brit Bit" edition, keyed by the Thursday it went live.
create table if not exists brit_bit_editions (
  edition_date           date primary key,
  hot_take               text,
  bet_you_didnt_know     text,
  britain_by_numbers     text,
  what_do_you_reckon     text,
  you_couldnt_make_it_up text,
  story_of_the_week      text,
  only_in_britain        text,
  created_at             timestamptz not null default now()
);

alter table brit_bit_editions enable row level security;

drop policy if exists "Public read access" on brit_bit_editions;
create policy "Public read access" on brit_bit_editions
  for select
  to anon, authenticated
  using (true);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists batches_set_updated_at on batches;
create trigger batches_set_updated_at before update on batches
  for each row execute function set_updated_at();
