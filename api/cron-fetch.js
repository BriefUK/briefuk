// DIAGNOSTIC: test all three imports together
import { RSS_FEEDS } from "./_lib/fetchNews.js";
import { storyHash } from "./_lib/claude.js";
import { getSupabaseService } from "./_lib/supabase.js";

export default function handler(req, res) {
  res.status(200).json({ ok: true, step: "all imports OK", feedCount: Object.keys(RSS_FEEDS).length, testHash: storyHash("test").length });
}
