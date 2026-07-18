-- Blackboard: curated editorial card series by BriefUK.
-- Each row is one slide/card within a named series.
-- card_type drives the frontend renderer: cover | stats | formula_table | bars | conclusion | generic
-- content (jsonb) holds all card-specific fields — schema varies by card_type.
-- Run once in Supabase SQL Editor.

create table if not exists blackboard_cards (
  id           uuid primary key default gen_random_uuid(),
  series_slug  text not null,
  series_title text not null,
  card_number  integer not null,
  card_type    text not null default 'generic',
  content      jsonb not null default '{}',
  sort_order   integer not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (series_slug, card_number)
);

create index if not exists blackboard_series_idx on blackboard_cards (series_slug, sort_order, card_number);

alter table blackboard_cards enable row level security;

drop policy if exists "Public read access" on blackboard_cards;
create policy "Public read access" on blackboard_cards
  for select to anon, authenticated using (published = true);

-- ── Seed: "What salary is actually comfortable in the UK?" ──────────────────

insert into blackboard_cards (series_slug, series_title, card_number, card_type, sort_order, content) values

('salary-comfort-2025', 'What salary is actually "comfortable" in the UK?', 1, 'cover', 10, '{
  "category_tag": "INSIGHTS · MONEY",
  "slide_number": 1,
  "headline_parts": [
    {"text": "What salary is actually ", "accent": false},
    {"text": "\"comfortable\"", "accent": true},
    {"text": " in the UK?", "accent": false}
  ],
  "subtext": "There isn''t one magic number. It depends mainly on three things: **where you live**, **your rent or mortgage**, and **how many people depend on your income.**",
  "footer": "Here''s the real breakdown, backed by official data."
}'::jsonb),

('salary-comfort-2025', 'What salary is actually "comfortable" in the UK?', 2, 'stats', 20, '{
  "section_label": "THE OFFICIAL BASELINE",
  "slide_number": 2,
  "pairs": [
    {"icon": "💼", "value": "£39,039", "label": "UK median full-time gross salary", "source": "ONS, 2025"},
    {"icon": "👤", "value": "£30,500", "label": "Minimum Income Standard for one adult", "source": "JRF, 2025"}
  ],
  "insight": "That means £30.5k may cover the basics — but \"getting by\" isn''t the same as being comfortable."
}'::jsonb),

('salary-comfort-2025', 'What salary is actually "comfortable" in the UK?', 3, 'formula_table', 30, '{
  "section_label": "OUR COMFORTABLE SALARY ESTIMATE",
  "slide_number": 3,
  "formula": "Minimum ×1.25 = \"Comfortable\"",
  "body": "JRF publishes the minimum needed for an acceptable living standard. The extra 25% is our estimate for savings, treats, unexpected costs and breathing room.",
  "table_headers": ["Household", "Minimum (JRF)", "Comfortable"],
  "table_rows": [
    ["🧑 Single adult", "£30,500", "~£38,000"],
    ["👫 Couple, no kids", "£43,000", "~£54,000"],
    ["👨‍👩‍👧‍👦 Couple, 2 kids", "£74,000", "~£92,500"],
    ["🧑‍👧‍👦 Lone parent, 2 kids", "£61,000", "~£76,000"]
  ],
  "footnote": "All figures gross, before tax."
}'::jsonb),

('salary-comfort-2025', 'What salary is actually "comfortable" in the UK?', 4, 'bars', 40, '{
  "section_label": "QUICK VERDICT · SINGLE ADULT",
  "slide_number": 4,
  "intro": "For a single adult outside London:",
  "bars": [
    {"salary": "£25k", "label": "Below the minimum",       "pct": 14},
    {"salary": "£30k", "label": "Around the minimum",      "pct": 30},
    {"salary": "£40k", "label": "Broadly comfortable",     "pct": 50},
    {"salary": "£50k", "label": "Comfortably above average","pct": 70},
    {"salary": "£60k+","label": "Well above typical pay",  "pct": 100}
  ],
  "note": "In London, housing costs can push this roughly **£15k–£20k** higher."
}'::jsonb),

('salary-comfort-2025', 'What salary is actually "comfortable" in the UK?', 5, 'conclusion', 50, '{
  "section_label": "BOTTOM LINE",
  "slide_number": 5,
  "headline": "A comfortable salary is not just about income.",
  "subtext": "It is about what is left after rent, bills, transport, childcare and debt.",
  "highlights": [
    {"color": "#16324F", "badge": "NATIONAL COMFORT ESTIMATE", "value": "£38,000", "description": "gross, single adult — a reasonable national estimate."},
    {"color": "#B8541F", "badge": "TAKE-HOME",                  "value": "£30,900", "description": "per year — about £2,570/month."}
  ],
  "sources": "Sources: ONS Employee Earnings 2025 · JRF Minimum Income Standard 2025 · GOV.UK rates & thresholds 2026/27"
}'::jsonb)

on conflict (series_slug, card_number) do nothing;
