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

// Triggered by an external scheduler (cron-job.org) hitting this public URL
// on a timer, not Vercel Cron — so this header check is the only thing
// stopping a random request from triggering a Claude run. CRON_SECRET must
// be set in the Vercel project's env vars, with the scheduler configured to
// send `Authorization: Bearer <the same value>` on every request.
function isAuthorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset only for local dev — never deploy without it
  return req.headers.authorization === `Bearer ${secret}`;
}

// The edition is dated to whichever Thursday is current or most recently
// passed, in UK local time — so a manual trigger on any other day of the
// week still lands on the right weekly edition.
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
    .map((s, i) => `${i + 1}. ${s.title} — ${(s.brief ?? "").slice(0, 200)}`)
    .join("\n");

  return `You write "The Brit Bit", a satirical weekly British news roundup — funnier, weirder and more honest than a normal news summary, but still grounded in real events. Using only the real UK stories below, write the 7 sections listed. Each section: 40-70 words, plain English, witty/dry British tone, ending on a complete sentence with no trailing dots. Reference specific real details from the stories (names, numbers, places) rather than vague generalities.

Sections (use exactly these JSON keys):
- hot_take: a sharp opinionated take on the week's biggest story
- bet_you_didnt_know: an overlooked detail from one of the stories nobody made a fuss about
- britain_by_numbers: 2-3 real numbers/statistics from this week's stories, framed to make the reader go "blimey"
- what_do_you_reckon: a provocative question to the reader about one of the stories
- you_couldnt_make_it_up: the most absurd or surreal real detail from the week
- story_of_the_week: the single most significant story, summarised with personality
- only_in_britain: something distinctly, characteristically British that happened this week

This week's stories:
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
    const { data: stories, error: storyErr } = await supabase
      .from("stories")
      .select("title, brief, published_at")
      .eq("category", "UK News")
      .gte("published_at", sevenDaysAgo)
      .order("published_at", { ascending: false })
      .limit(25);

    if (storyErr) throw storyErr;
    if (!stories || stories.length === 0) {
      res.status(200).json({ skipped: "no stories in the last 7 days" });
      return;
    }

    const prompt = buildPrompt(stories);
    const raw = await complete(prompt, 1200);
    const edition = parseEdition(raw);

    const { error: upsertErr } = await supabase
      .from("brit_bit_editions")
      .upsert({ edition_date: editionDate, ...edition }, { onConflict: "edition_date" });
    if (upsertErr) throw upsertErr;

    res.status(200).json({ editionDate, storiesUsed: stories.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
