// DIAGNOSTIC: test fetchNews.js import (pulls in xml2js)
import { RSS_FEEDS } from "./_lib/fetchNews.js";

export default function handler(req, res) {
  res.status(200).json({ ok: true, step: "fetchNews import OK", feedCount: Object.keys(RSS_FEEDS).length });
}
