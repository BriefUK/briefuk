import { getCategoryNews } from "./_lib/fetchNews.js";

export default async function handler(req, res) {
  const { category } = req.query;
  if (!category) {
    res.status(400).json({ error: "Missing required 'category' query parameter" });
    return;
  }

  const items = await getCategoryNews(category);
  if (items === null) {
    res.status(404).json({ error: `Unknown category: ${category}` });
    return;
  }

  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
  res.status(200).json({ items });
}
