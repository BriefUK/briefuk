import { getSupabaseAnon } from "./_lib/supabase.js";

export default async function handler(req, res) {
  const supabase = getSupabaseAnon();
  const { data, error } = await supabase
    .from("brit_bit_editions")
    .select("*")
    .order("edition_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "No edition published yet" });
    return;
  }

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).json({ edition: data });
}
