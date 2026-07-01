import { RSS_FEEDS, getCategoryNews } from "./_lib/fetchNews.js";
import { submitSummaryBatch, pollSummaryBatch, storyHash } from "./_lib/claude.js";
import { getSupabaseService } from "./_lib/supabase.js";

function isAuthorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

// Vercel kills the function as soon as the response is sent — fire-and-forget
// does not work. Instead: fetch all categories in parallel (cuts RSS time from
// ~35s to ~8s), then run the full pipeline synchronously before responding.
// cron-job.org's 30s client timeout is handled by /api/cron-resume, which
// runs every 30 min and resolves any in-progress batch that outlasted the
// cron-fetch window.
const TIME_BUDGET_MS = 55_000;
const POLL_INTERVAL_MS = 5_000;

const CATEGORY_PRIORITY = [
  "Crime", "Money", "Health", "Politics", "Technology", "Sport", "Business",
  "Entertainment", "UK News", "World",
];

const DEDUP_LOOKBACK_DAYS = 30;
const PAGE_SIZE = 1000;

function toStoryRow(item, category) {
  return {
    url: item.id,
    title: item.title,
    description: item.brief,
    source: item.source,
    category,
    image_url: item.image,
    published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
  };
}

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

export async function insertFinishedStories(supabase, pendingStories, briefs) {
  const rows = pendingStories
    .map((s) => {
      const brief = briefs.get(storyHash(s.url));
      if (!brief) return null;
      const { description, ...row } = s;
      const wordCount = brief.trim().split(/\s+/).filter(Boolean).length;
      return { ...row, brief, word_count: wordCount };
    })
    .filter(Boolean);
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("stories").upsert(rows, { onConflict: "url", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

export async function resumePendingBatch(supabase, deadline) {
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
      const written = await insertFinishedStories(supabase, pending.pending_stories, briefs);
      const { error: updateErr } = await supabase.from("batches").update({ status: "completed" }).eq("id", pending.id);
      if (updateErr) throw updateErr;
      return { resumed: true, finished: true, written };
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
  const summary = { resumedBatch: null, categoriesProcessed: 0, newStoriesFound: 0, batchSubmitted: null };

  try {
    // Resolve any batch left over from a previous run that hit the time limit.
    summary.resumedBatch = await resumePendingBatch(supabase, deadline);
    console.log("[cron-fetch] resumedBatch:", JSON.stringify(summary.resumedBatch));

    // Fetch all 10 categories in parallel — cuts RSS time from ~35s to ~8s.
    console.log("[cron-fetch] fetching RSS (parallel)");
    const categoryList = Object.keys(RSS_FEEDS);
    const results = await Promise.all(categoryList.map((cat) => getCategoryNews(cat)));
    const itemsByCategory = new Map(categoryList.map((cat, i) => [cat, results[i]]));
    summary.categoriesProcessed = categoryList.length;
    console.log("[cron-fetch] RSS done");

    const claimed = new Map();
    for (const category of CATEGORY_PRIORITY) {
      for (const item of itemsByCategory.get(category) ?? []) {
        if (!item.id || claimed.has(item.id)) continue;
        claimed.set(item.id, toStoryRow(item, category));
      }
    }
    console.log("[cron-fetch] claimed:", claimed.size);

    const existingUrls = await fetchRecentUrls(supabase);
    console.log("[cron-fetch] existingUrls:", existingUrls.size);

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
    console.log("[cron-fetch] newStoriesFound:", newStories.length);

    if (newStories.length > 0 && Date.now() < deadline) {
      const batchId = await submitSummaryBatch(newStories);
      console.log("[cron-fetch] batch submitted:", batchId);

      const { error: insertErr } = await supabase.from("batches").insert({
        id: batchId,
        status: "in_progress",
        pending_stories: newStories,
      });
      if (insertErr) throw insertErr;
      summary.batchSubmitted = batchId;

      // Poll within the remaining budget. If time runs out, /api/cron-resume
      // will pick it up and write the results on a subsequent call.
      while (Date.now() < deadline) {
        const { done, briefs } = await pollSummaryBatch(batchId);
        if (done) {
          const written = await insertFinishedStories(supabase, newStories, briefs);
          const { error: updateErr } = await supabase.from("batches").update({ status: "completed" }).eq("id", batchId);
          if (updateErr) throw updateErr;
          console.log("[cron-fetch] stories written:", written);
          break;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }

    console.log("[cron-fetch] done:", JSON.stringify(summary));
    res.status(200).json(summary);
  } catch (err) {
    console.error("[cron-fetch] error:", err.message, err.stack);
    res.status(500).json({ error: err.message, ...summary });
  }
}
