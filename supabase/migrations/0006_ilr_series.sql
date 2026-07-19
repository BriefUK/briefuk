-- Blackboard series: "What is ILR?"
-- Run this in the Supabase SQL Editor

insert into blackboard_cards
  (series_slug, series_title, card_number, card_type, sort_order, published, content)
values
  ('what-is-ilr', 'What is ILR?', 1, 'image', 10, true, '{"image_url": "/blackboard/ilr/ilr_1.png"}'::jsonb),
  ('what-is-ilr', 'What is ILR?', 2, 'image', 20, true, '{"image_url": "/blackboard/ilr/ilr_2.png"}'::jsonb),
  ('what-is-ilr', 'What is ILR?', 3, 'image', 30, true, '{"image_url": "/blackboard/ilr/ilr_3.png"}'::jsonb),
  ('what-is-ilr', 'What is ILR?', 4, 'image', 40, true, '{"image_url": "/blackboard/ilr/ilr_4.png"}'::jsonb),
  ('what-is-ilr', 'What is ILR?', 5, 'image', 50, true, '{"image_url": "/blackboard/ilr/ilr_5.png"}'::jsonb)
on conflict (series_slug, card_number) do update
  set card_type    = excluded.card_type,
      sort_order   = excluded.sort_order,
      published    = excluded.published,
      content      = excluded.content,
      series_title = excluded.series_title;
