import { RSS_FEEDS, getCategoryNews } from "./_lib/fetchNews.js";
import { submitSummaryBatch, pollSummaryBatch, storyHash } from "./_lib/claude.js";
import { getSupabaseService } from "./_lib/supabase.js";

// Vercel Cron invocations carry this header automatically; reject anything
// else so the endpoint can't be triggered (and run up API spend) by a
// random public request.
function isAuthorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (e.g. local dev)
  return req.headers.authorization === `Bearer ${secret}`;
}

// Leaves headroom under the function's time limit so a slow batch can be
// picked up and finished by next run instead of crashing mid-poll.
const TIME_BUDGET_MS = 50_000;
const POLL_INTERVAL_MS = 5_000;

// `stories.category` is a single column, not a list — a story matching both
// a keyword-filtered tab (Crime, Money, ...) and a catch-all tab (UK News,
// World) must pick one. Specific categories are claimed first so the
// catch-alls don't starve the filtered tabs.
const CATEGORY_PRIORITY = [
  "Crime", "Money", "Health", "Politics", "Technology", "Sport", "Business",
  "Entertainment", "UK News", "World",
];

// No RSS feed ever resurfaces an article older than a few weeks, so dedup
// only needs to look back this far — keeps the query bounded forever
// instead of growing with the lifetime total of stories ever stored.
const DEDUP_LOOKBACK_DAYS = 30;
const PAGE_SIZE = 1000;

function toStoryRow(item, category) {
  return {
    url: item.id,
    title: item.title,
    description: item.brief, // raw RSS text — only used to build the Claude prompt, never persisted
    source: item.source,
    category,
    image_url: item.image,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
  };
}

// Fetches existing URLs as a plain (unfiltered-by-list) paginated select —
// passing hundreds of full URLs into a `.in()` filter blows past Supabase's
// URI length limit (414) and fails silently if the error isn't checked.
async function fetchRecentUrls(supabase) {
  const since = new Date(Date.now() - DEDUP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const urls = new Set();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("stories")
      .select("url")
      .gte("created_at", since)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data) urls.add(row.url);
    if (data.length < PAGE_SIZE) break;
  }
  return urls;
}

// Stories only land in `stories` once a real summary exists for them, so
// any request whose batch result errored is simply left out — it has no
// row yet, so it's picked up as "new" again on a future run and retried.
async function insertFinishedStories(supabase, pendingStories, briefs) {
  const rows = pendingStories
    .map((s) => {
      const brief = briefs.get(storyHash(s.url));
      if (!brief) return null;
      const { description, ...row } = s;
      const wordCount = brief.trim().split(/\s+/).filter(Boolean).length;
      return { ...row, brief, word_count: wordCount };
    })
    .filter(Boolean);
  if (rows.length === 0) return;
  const { error } = await supabase.from("stories").upsert(rows, { onConflict: "url", ignoreDuplicates: true });
  if (error) throw error;
}

async function resumePendingBatch(supabase, deadline) {
  const { data: pending, error } = await supabase
    .from("batches")
    .select("*")
    .eq("status", "in_progress")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!pending) return { resumed: false };

  while (Date.now() < deadline) {
    const { done, briefs } = await pollSummaryBatch(pending.id);
    if (done) {
      await insertFinishedStories(supabase, pending.pending_stories, briefs);
      const { error: updateErr } = await supabase.from("batches").update({ status: "completed" }).eq("id", pending.id);
      if (updateErr) throw updateErr;
      return { resumed: true, finished: true };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { resumed: true, finished: false };
}

export default async function handler(req, res) {
  if (!isAuthorised(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  const supabase = getSupabaseService();
  const summary = { resumedBatch: null, newStoriesFound: 0, newBatchSubmitted: null, categoriesProcessed: 0 };

  try {
    // Finish off a batch left over from a previous run before submitting a new one.
    summary.resumedBatch = await resumePendingBatch(supabase, deadline);

    const itemsByCategory = new Map();
    for (const category of Object.keys(RSS_FEEDS)) {
      itemsByCategory.set(category, await getCategoryNews(category));
      summary.categoriesProcessed++;
    }

    const claimed = new Map(); // url -> story row, one entry per url across all categories
    for (const category of CATEGORY_PRIORITY) {
      for (const item of itemsByCategory.get(category) ?? []) {
        if (!item.id || claimed.has(item.id)) continue;
        claimed.set(item.id, toStoryRow(item, category));
      }
    }

    const existingUrls = await fetchRecentUrls(supabase);

    // URLs already queued in another in-progress batch must not be resubmitted.
    const { data: pendingBatches, error: pendingErr } = await supabase
      .from("batches")
      .select("pending_stories")
      .eq("status", "in_progress");
    if (pendingErr) throw pendingErr;
    const inFlightUrls = new Set(
      (pendingBatches ?? []).flatMap((b) => b.pending_stories.map((s) => s.url))
    );

    const newStories = [...claimed.values()].filter(
      (s) => !existingUrls.has(s.url) && !inFlightUrls.has(s.url)
    );
    summary.newStoriesFound = newStories.length;

    if (newStories.length > 0 && Date.now() < deadline) {
      const batchId = await submitSummaryBatch(newStories);
      const { error: insertErr } = await supabase.from("batches").insert({
        id: batchId,
        status: "in_progress",
        pending_stories: newStories,
      });
      if (insertErr) throw insertErr;
      summary.newBatchSubmitted = batchId;

      // Best-effort: poll briefly in case it finishes fast, otherwise the
      // next cron run picks it up via resumePendingBatch.
      while (Date.now() < deadline) {
        const { done, briefs } = await pollSummaryBatch(batchId);
        if (done) {
          await insertFinishedStories(supabase, newStories, briefs);
          const { error: updateErr } = await supabase.from("batches").update({ status: "completed" }).eq("id", batchId);
          if (updateErr) throw updateErr;
          break;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }

    res.status(200).json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message, ...summary });
  }
}
