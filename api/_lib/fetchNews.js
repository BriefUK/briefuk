import xml2js from "xml2js";

const { parseStringPromise } = xml2js;

// Reuters and Digital Spy no longer publish public RSS feeds (Reuters dropped
// theirs in 2020; Digital Spy's feed URLs all 404 now) — substituted with
// Sky News World and Evening Standard Showbiz respectively.
export const RSS_FEEDS = {
  "UK News": [
    { url: "https://feeds.bbci.co.uk/news/uk/rss.xml", name: "BBC News" },
    { url: "https://www.theguardian.com/uk/rss", name: "The Guardian" },
    { url: "https://feeds.skynews.com/feeds/rss/uk.xml", name: "Sky News" },
    { url: "https://www.independent.co.uk/news/uk/rss", name: "The Independent" },
  ],
  World: [
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml", name: "BBC News" },
    { url: "https://www.theguardian.com/world/rss", name: "The Guardian" },
    { url: "https://feeds.skynews.com/feeds/rss/world.xml", name: "Sky News" },
  ],
  Politics: [
    { url: "https://feeds.bbci.co.uk/news/politics/rss.xml", name: "BBC News" },
    { url: "https://www.theguardian.com/politics/rss", name: "The Guardian" },
    { url: "https://www.independent.co.uk/news/uk/politics/rss", name: "The Independent" },
  ],
  Money: [
    { url: "https://feeds.bbci.co.uk/news/business/rss.xml", name: "BBC News" },
    { url: "https://www.theguardian.com/uk/money/rss", name: "The Guardian" },
    { url: "https://www.thisismoney.co.uk/money/index.rss", name: "This Is Money" },
  ],
  Crime: [
    { url: "https://feeds.bbci.co.uk/news/uk/rss.xml", name: "BBC News" },
    { url: "https://www.mirror.co.uk/all-about/crime/rss.xml", name: "The Mirror" },
    { url: "https://www.independent.co.uk/news/uk/crime/rss", name: "The Independent" },
  ],
  Health: [
    { url: "https://feeds.bbci.co.uk/news/health/rss.xml", name: "BBC News" },
    { url: "https://www.theguardian.com/society/health/rss", name: "The Guardian" },
    { url: "https://www.england.nhs.uk/feed/", name: "NHS England" },
  ],
  Business: [
    { url: "https://feeds.bbci.co.uk/news/business/rss.xml", name: "BBC News" },
    { url: "https://www.theguardian.com/uk/business/rss", name: "The Guardian" },
    { url: "https://www.cityam.com/feed/", name: "City A.M." },
  ],
  Technology: [
    { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", name: "BBC News" },
    { url: "https://www.theguardian.com/uk/technology/rss", name: "The Guardian" },
    { url: "https://www.theregister.com/headlines.atom", name: "The Register" },
  ],
  Sport: [
    { url: "https://feeds.bbci.co.uk/sport/rss.xml", name: "BBC Sport" },
    { url: "https://www.theguardian.com/uk/sport/rss", name: "The Guardian" },
    { url: "https://www.skysports.com/rss/12040", name: "Sky Sports" },
  ],
  Entertainment: [
    { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", name: "BBC News" },
    { url: "https://www.theguardian.com/culture/rss", name: "The Guardian" },
    { url: "https://www.standard.co.uk/showbiz/rss", name: "Evening Standard" },
  ],
};

function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, "").trim() : "";
}

function truncate60(text) {
  if (!text) return "";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 60) return text;
  return words.slice(0, 60).join(" ") + "…";
}

// xml2js represents an element as a plain string only when it has no
// attributes; once attributes are present (e.g. <guid isPermaLink="false">)
// the text content moves to the "_" key.
function textOf(field) {
  if (field == null) return "";
  if (typeof field === "string") return field;
  return field._ ?? "";
}

function toArray(field) {
  if (field == null) return [];
  return Array.isArray(field) ? field : [field];
}

// Some feeds (Guardian, Independent, Standard) publish several
// <media:content> sizes per item — pick the widest one available.
function bestMediaContent(item) {
  const candidates = toArray(item["media:content"]).filter((c) => c?.url);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => ((Number(c.width) || 0) > (Number(best.width) || 0) ? c : best)).url;
}

// BBC's ichef CDN encodes the requested width in the path
// (.../standard/240/...) and <media:thumbnail> always asks for a small
// 240px version — request a much larger size from the same CDN instead.
function upgradeBbcThumbnail(url) {
  if (!url || !url.includes("ichef.bbci.co.uk")) return url;
  return url.replace(/\/standard\/\d+\//, "/standard/976/");
}

// JS's Date parser only reliably recognises GMT/UT and numeric offsets in
// RFC 822-style strings — some feeds (Sky Sports) use local abbreviations
// like "BST" that parse as Invalid Date. Normalise to a real ISO string (or
// null) here so every downstream consumer gets a clean, parseable value.
const TZ_OFFSETS = { GMT: "+0000", UT: "+0000", UTC: "+0000", BST: "+0100", EST: "-0500", EDT: "-0400" };

function normalizePubDate(raw) {
  if (!raw) return null;
  const fixed = raw.replace(/\b(GMT|UT|UTC|BST|EST|EDT)$/, (tz) => TZ_OFFSETS[tz]);
  const date = new Date(fixed);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function firstImgFromHtml(html) {
  const match = /<img[^>]+src=["']([^"'>]+)["']/i.exec(html || "");
  return match ? match[1] : null;
}

// <media:content> is usually full resolution; <enclosure>/<media:thumbnail>
// are sometimes a genuine full-size image (Sky News, The Register) and
// sometimes a tiny thumbnail (Mirror, This Is Money) — media:content wins
// when present, otherwise fall back in roughly that order, then finally
// scrape an <img> out of the article HTML (City A.M., NHS England).
function pickImage(item) {
  const url =
    bestMediaContent(item) ||
    toArray(item.enclosure)[0]?.url ||
    toArray(item["media:thumbnail"])[0]?.url ||
    firstImgFromHtml(textOf(item["content:encoded"]) || textOf(item.description));
  return url ? upgradeBbcThumbnail(url) : null;
}

async function fetchFeed({ url, name }) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "BriefUK/1.0 (+https://briefuk.app)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
    });

    const channel = parsed?.rss?.channel;
    if (!channel) return [];
    const items = Array.isArray(channel.item)
      ? channel.item
      : channel.item
      ? [channel.item]
      : [];

    return items.map((item) => {
      return {
        id: textOf(item.link) || textOf(item.guid),
        title: stripHtml(textOf(item.title)),
        brief: truncate60(stripHtml(textOf(item.description))),
        link: textOf(item.link),
        source: name,
        pubDate: normalizePubDate(textOf(item.pubDate)),
        image: pickImage(item),
      };
    });
  } catch {
    return [];
  }
}

function deduplicate(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .slice(0, 6)
      .join(" ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Keyword lists for each category that needs filtering.
// "UK News" and "World" have no entry — they show all stories.
const CATEGORY_FILTERS = {
  Crime:       ["crime", "murder", "arrest", "police", "court", "sentence", "prison", "theft", "fraud", "attack", "assault", "stabbing", "shooting", "robbery", "guilty", "verdict", "trial", "convicted"],
  Money:       ["mortgage", "savings", "pension", "budget", "tax", "salary", "wage", "cost of living", "energy bills", "inflation", "interest rate", "rent", "debt", "loan"],
  Health:      ["nhs", "hospital", "cancer", "mental health", "vaccine", "drug", "treatment", "medical", "doctor", "disease", "health"],
  Politics:    ["parliament", "mp", "minister", "government", "labour", "conservative", "starmer", "election", "policy", "bill", "vote"],
  Technology:  ["ai", "tech", "apple", "google", "microsoft", "cyber", "app", "software", "robot", "digital", "internet"],
  Sport:       ["football", "cricket", "tennis", "rugby", "golf", "olympics", "match", "league", "goal", "player", "team", "manager"],
  Business:    ["company", "ceo", "profit", "shares", "stock market", "economy", "trade", "investment", "startup", "merger"],
};

// Phrases that mean a story is *about* the category as a media genre or
// passing mention rather than being actual category news — e.g. a TV review
// of a "crime drama" matches the bare "crime" keyword above, and a personal
// story that happens to mention being "in debt" matches Money. Any match
// here disqualifies the item regardless of CATEGORY_FILTERS.
const CATEGORY_EXCLUDES = {
  Crime: ["crime drama", "crime thriller", "crime series", "crime novel", "crime film", "crime fiction", "true crime podcast", "binge watch", "binge-watch"],
};

// Word-boundary matching avoids false positives from short keywords
// (e.g. "mp" inside "computer", "ai" inside "rain").
function textMatches(text, phrases) {
  return phrases.some((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  });
}

function matchesCategory(item, category) {
  const text = `${item.title} ${item.brief}`.toLowerCase();
  const excludes = CATEGORY_EXCLUDES[category];
  if (excludes && textMatches(text, excludes)) return false;
  return textMatches(text, CATEGORY_FILTERS[category]);
}

// Returns null when `category` isn't a known feed key.
export async function getCategoryNews(category) {
  const feeds = RSS_FEEDS[category];
  if (!feeds) return null;
  const results = await Promise.all(feeds.map(fetchFeed));
  const unique = deduplicate(results.flat());
  const sorted = unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return CATEGORY_FILTERS[category] ? sorted.filter((item) => matchesCategory(item, category)) : sorted;
}
