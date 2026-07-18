-- Add expires_at to brit_bit_editions so the frontend can hide stale content.
-- Backfill existing rows: expire 7 days after creation.
-- Run once in Supabase SQL Editor.

alter table brit_bit_editions
  add column if not exists expires_at timestamptz;

update brit_bit_editions
  set expires_at = created_at + interval '7 days'
  where expires_at is null;
