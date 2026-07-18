import { getSupabaseAnon } from "./_lib/supabase.js";

export default async function handler(req, res) {
  const supabase = getSupabaseAnon();

  // Return all published cards for the most recently added series.
  const { data, error } = await supabase
    .from("blackboard_cards")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .order("card_number", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data || data.length === 0) {
    res.status(404).json({ error: "No blackboard cards published yet" });
    return;
  }

  // Group into series, return the most recently created one.
  const bySeries = {};
  for (const card of data) {
    if (!bySeries[card.series_slug]) {
      bySeries[card.series_slug] = { series_slug: card.series_slug, series_title: card.series_title, created_at: card.created_at, cards: [] };
    }
    bySeries[card.series_slug].cards.push(card);
  }
  const series = Object.values(bySeries).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).json(series[0]);
}
