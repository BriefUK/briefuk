import { complete } from "./_lib/claude.js";
import { getSupabaseService } from "./_lib/supabase.js";

// Section definitions — label describes the tone/angle for Claude.
const SECTIONS = [
  { key: "hot_take",             label: "The Hot Take",           angle: "a sharp opinionated take on this story" },
  { key: "bet_you_didnt_know",   label: "Bet You Didn't Know",    angle: "an overlooked or underreported detail from this story that nobody made a fuss about" },
  { key: "britain_by_numbers",   label: "Britain by Numbers",     angle: "2-3 specific numbers or statistics from this story, framed to make the reader go 'blimey'" },
  { key: "what_do_you_reckon",   label: "What Do You Reckon?",    angle: "a provocative question to the reader prompted by this story" },
  { key: "you_couldnt_make_it_up", label: "You Couldn't Make It Up", angle: "the most absurd or surreal real detail from this story" },
  { key: "story_of_the_week",   label: "Story of the Week",       angle: "the significance of this story, summarised with personality" },
  { key: "only_in_britain",     label: "Only in Britain",         angle: "what makes this story distinctly, characteristically British" },
];

// Preferred evergreen categories in priority order.
// Sport and Politics excluded: too fast-moving for a weekly roundup.
const PREFERRED_CATEGORIES = ["Health", "Money", "Crime", "Technology", "UK News"];

// Words that signal time-sensitive content that reads as stale by Thursday.
const TIME_SENSITIVE_RE = /\b(tonight|today|yesterday|this weekend|kick-?off|final score|full[- ]time|match day)\b| vs |\bfixture\b|\bscore[sd]?\b/i;

function isTimeSensitive(story) {
  return TIME_SENSITIVE_RE.test(`${story.title} ${story.brief ?? ""}`);
}

function isAuthorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

function mostRecentThursdayUK() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const daysSinceThursday = (weekdayMap[get("weekday")] - 4 + 7) % 7;
  const ukDate = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00Z`);
  ukDate.setUTCDate(ukDate.getUTCDate() - daysSinceThursday);
  return ukDate.toISOString().slice(0, 10);
}

// Round-robin pick across categories so we get one story per section from
// a spread of topics. Each section gets a DIFFERENT story — no story is
// passed to more than one section, making repetition structurally impossible.
function pickOnePerSection(deduped) {
  const byCategory = Object.fromEntries(PREFERRED_CATEGORIES.map((c) => [c, []]));
  for (const s of deduped) {
    if (byCategory[s.category]) byCategory[s.category].push(s);
  }

  const picked = [];
  let round = 0;
  while (picked.length < SECTIONS.length) {
    let added = false;
    for (const cat of PREFERRED_CATEGORIES) {
      if (picked.length >= SECTIONS.length) break;
      if (byCategory[cat][round]) { picked.push(byCategory[cat][round]); added = true; }
    }
    if (!added) break;
    round++;
  }
  return picked;
}

// Each section is given EXACTLY ONE story — Claude's only job is to write
// that section in the right tone using only the story assigned to it.
function buildPrompt(assignments) {
  const blocks = assignments.map(({ section, story }) =>
    `--- ${section.label} (key: "${section.key}") ---
Angle: ${section.angle}
Story: ${story.title} — ${story.brief ?? ""}`
  ).join("\n\n");

  return `You write "The Brit Bit", a satirical weekly British news roundup — funnier, weirder and more honest than a normal news summary, grounded in real UK events.

Below are 7 sections, each with its own assigned story. Write each section using ONLY its assigned story — do not bring in details from any other section's story.

Rules for every section:
- 40–70 words, plain English, witty and dry British tone
- End on a complete sentence with a full stop
- Reference specific real details (names, numbers, places) from the assigned story
- Do not mention dates, days, or time references ("this week", "on Monday", "recently") — write as if timeless

${blocks}

Respond with ONLY a valid JSON object with these 7 keys: ${SECTIONS.map((s) => `"${s.key}"`).join(", ")}. No markdown fences, no commentary.`;
}

function parseEdition(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  for (const { key } of SECTIONS) {
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

    const { data: rawStories, error: storyErr } = await supabase
      .from("stories")
      .select("title, brief, category, published_at")
      .in("category", PREFERRED_CATEGORIES)
      .gte("published_at", sevenDaysAgo)
      .order("published_at", { ascending: false })
      .limit(80);

    if (storyErr) throw storyErr;

    // Filter time-sensitive stories, then deduplicate by normalised title.
    const seen = new Set();
    const deduped = (rawStories ?? [])
      .filter((s) => !isTimeSensitive(s))
      .filter((s) => {
        const key = s.title.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    // Sort: category priority first, then recency within each category.
    deduped.sort((a, b) => {
      const ai = PREFERRED_CATEGORIES.indexOf(a.category);
      const bi = PREFERRED_CATEGORIES.indexOf(b.category);
      if (ai !== bi) return ai - bi;
      return new Date(b.published_at) - new Date(a.published_at);
    });

    // Pick exactly 7 stories — one per section — via category round-robin.
    const picked = pickOnePerSection(deduped);

    if (picked.length < SECTIONS.length) {
      res.status(200).json({ skipped: `only ${picked.length} usable stories this week (need ${SECTIONS.length})` });
      return;
    }

    // Pair each section with its dedicated story.
    const assignments = SECTIONS.map((section, i) => ({ section, story: picked[i] }));

    console.log(`[cron-brit-bit] ${rawStories?.length} fetched → ${deduped.length} usable → 7 assigned (one per section):`);
    assignments.forEach(({ section, story }) =>
      console.log(`  ${section.key}: [${story.category}] ${story.title}`)
    );

    const prompt = buildPrompt(assignments);
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

    res.status(200).json({ editionDate, storiesUsed: picked.length, expiresAt });
  } catch (err) {
    console.error("[cron-brit-bit] error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
