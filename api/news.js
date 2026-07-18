import { RSS_FEEDS } from "./_lib/fetchNews.js";
import { getSupabaseAnon } from "./_lib/supabase.js";

const KNOWN_CATEGORIES = new Set(Object.keys(RSS_FEEDS));

export default async function handler(req, res) {
  const { category } = req.query;
  if (!category) {
    res.status(400).json({ error: "Missing required 'category' query parameter" });
    return;
  }
  if (!KNOWN_CATEGORIES.has(category)) {
    res.status(404).json({ error: `Unknown category: ${category}` });
    return;
  }

  const supabase = getSupabaseAnon();
  const { data: stories, error } = await supabase
    .from("stories")
    .select("url, title, brief, source, image_url, published_at, word_count")
    .eq("category", category)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const items = stories.map((s) => ({
    id: s.url,
    title: s.title,
    brief: s.brief,
    link: s.url,
    source: s.source,
    pubDate: s.published_at,
    image: s.image_url,
    wordCount: s.word_count,
  }));

  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
  res.status(200).json({ items });
}
