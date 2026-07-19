import { getSupabaseService } from "./_lib/supabase.js";

export default async function handler(req, res) {
  const supabase = getSupabaseService();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("blackboard_cards")
      .select("*")
      .order("series_slug", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("card_number", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ cards: data });
  }

  if (req.method === "POST") {
    const { data, error } = await supabase
      .from("blackboard_cards")
      .insert([req.body])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ card: data });
  }

  if (req.method === "PUT") {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const { error: updateErr } = await supabase
      .from("blackboard_cards")
      .update(req.body)
      .eq("id", id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    return res.status(200).json({ updated: true });
  }

  if (req.method === "DELETE") {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const { error } = await supabase.from("blackboard_cards").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ deleted: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
