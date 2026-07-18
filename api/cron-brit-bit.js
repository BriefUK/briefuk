import { complete } from "./_lib/claude.js";
import { getSupabaseService } from "./_lib/supabase.js";

const SECTIONS = [
  "hot_take",
  "bet_you_didnt_know",
  "britain_by_numbers",
  "what_do_you_reckon",
  "you_couldnt_make_it_up",
  "story_of_the_week",
  "only_in_britain",
];

// Categories to draw from, in priority order. Sport and Politics are excluded:
// Sport goes stale within hours; Politics changes too fast for a weekly roundup.
const PREFERRED_CATEGORIES = ["Health", "Money", "Crime", "Technology", "UK News"];

// Words that signal time-sensitive content that will read as stale by Thursday.
const TIME_SENSITIVE_RE = /\b(tonight|today|yesterday|this weekend|kick-?off|final score|full[- ]time|match day)\b| vs |\bfixture\b|\bscore[sd]?\b/i;

function isTimeSensitive(story) {
  const text = `${story.title} ${story.brief ?? ""}`;
  return TIME_SENSITIVE_RE.test(text);
}

function isAuthorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

function mostRecentThursdayUK() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[get("weekday")];
  const daysSinceThursday = (weekday - 4 + 7) % 7;
  const ukDate = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00Z`);
  ukDate.setUTCDate(ukDate.getUTCDate() - daysSinceThursday);
  return ukDate.toISOString().slice(0, 10);
}

function buildPrompt(stories) {
  const digest = stories
    .map((s, i) => `${i + 1}. [${s.category}] ${s.title} — ${(s.brief ?? "").slice(0, 200)}`)
    .join("\n");

  return `You write "The Brit Bit", a satirical weekly British news roundup — funnier, weirder and more honest than a normal news summary, but still grounded in real events. Using only the real UK stories below, write the 7 sections listed.

Rules:
- Each section: 40-70 words, plain English, witty/dry British tone, ending on a complete sentence with a full stop
- Reference specific real details from the stories (names, numbers, places) — no vague generalities
- Use each story in AT MOST ONE section — do not reference the same story in two different sections
- Do not mention dates, days, or time references (e.g. "this week", "on Monday") — write as if timeless

Sections (use exactly these JSON keys):
- hot_take: a sharp opinionated take on the week's biggest story
- bet_you_didnt_know: an overlooked detail from one of the stories nobody made a fuss about
- britain_by_numbers: 2-3 real numbers/statistics from this week's stories, framed to make the reader go "blimey"
- what_do_you_reckon: a provocative question to the reader about one of the stories
- you_couldnt_make_it_up: the most absurd or surreal real detail from the week
- story_of_the_week: the single most significant story, summarised with personality
- only_in_britain: something distinctly, characteristically British that happened this week

Stories:
${digest}

Respond with ONLY a JSON object with these 7 keys and string values, no markdown fences, no commentary.`;
}

function parseEdition(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  for (const key of SECTIONS) {
    if (typeof parsed[key] !== "string" || !parsed[key].trim()) {
      throw new Error(`Missing or empty section: ${key}`);
    }
  }
  return parsed;
}

export default async function handler(req, res) {
  if (!isAuthorised(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const supabase = getSupabaseService();
    const editionDate = mostRecentThursdayUK();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch from preferred evergreen categories only — Sport and Politics excluded.
    const { data: rawStories, error: storyErr } = await supabase
      .from("stories")
      .select("title, brief, category, published_at")
      .in("category", PREFERRED_CATEGORIES)
      .gte("published_at", sevenDaysAgo)
      .order("published_at", { ascending: false })
      .limit(80);

    if (storyErr) throw storyErr;

    // Remove time-sensitive stories that will read as stale by Thursday.
    const filtered = (rawStories ?? []).filter((s) => !isTimeSensitive(s));

    // Deduplicate by title (same headline from multiple sources).
    const seen = new Set();
    const deduped = filtered.filter((s) => {
      const key = s.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by category priority then recency — ensures diverse evergreen content.
    deduped.sort((a, b) => {
      const ai = PREFERRED_CATEGORIES.indexOf(a.category);
      const bi = PREFERRED_CATEGORIES.indexOf(b.category);
      if (ai !== bi) return ai - bi;
      return new Date(b.published_at) - new Date(a.published_at);
    });

    const stories = deduped.slice(0, 30);

    if (stories.length < 7) {
      res.status(200).json({ skipped: `only ${stories.length} usable stories this week (need ≥7)` });
      return;
    }

    console.log(`[cron-brit-bit] ${rawStories?.length} fetched → ${filtered.length} after time-filter → ${deduped.length} deduped → ${stories.length} sent to Claude`);

    const prompt = buildPrompt(stories);
    const raw = await complete(prompt, 1200);
    const edition = parseEdition(raw);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: upsertErr } = await supabase
      .from("brit_bit_editions")
      .upsert(
        { edition_date: editionDate, ...edition, expires_at: expiresAt },
        { onConflict: "edition_date" }
      );
    if (upsertErr) throw upsertErr;

    res.status(200).json({ editionDate, storiesUsed: stories.length, expiresAt });
  } catch (err) {
    console.error("[cron-brit-bit] error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
