// DIAGNOSTIC: test fetchNews.js + claude.js imports
import { RSS_FEEDS } from "./_lib/fetchNews.js";
import { storyHash } from "./_lib/claude.js";

export default function handler(req, res) {
  res.status(200).json({ ok: true, step: "claude import OK", testHash: storyHash("test").length });
}
