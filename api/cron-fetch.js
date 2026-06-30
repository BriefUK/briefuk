import { RSS_FEEDS, getCategoryNews } from "./_lib/fetchNews.js";
import { submitSummaryBatch, pollSummaryBatch, storyHash } from "./_lib/claude.js";
import { getSupabaseService } from "./_lib/supabase.js";

function isAuthorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

const TIME_BUDGET_MS = 50_000;
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
  console.log("[cron-fetch] Function started");
  console.log("[cron-fetch] Env vars present:", {
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
  });
  console.log("[cron-fetch] Method:", req.method);

  if (!isAuthorised(req)) {
    console.log("[cron-fetch] Unauthorized");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  console.log("[cron-fetch] Auth passed");

  const deadline = Date.now() + TIME_BUDGET_MS;
  const summary = { resumedBatch: null, newStoriesFound: 0, newBatchSubmitted: null, categoriesProcessed: 0 };

  try {
    console.log("[cron-fetch] Step 1: init Supabase");
    const supabase = getSupabaseService();
    console.log("[cron-fetch] Step 1 done");

    console.log("[cron-fetch] Step 2: resumePendingBatch");
    summary.resumedBatch = await resumePendingBatch(supabase, deadline);
    console.log("[cron-fetch] Step 2 done:", JSON.stringify(summary.resumedBatch));

    console.log("[cron-fetch] Step 3: fetch RSS for all categories");
    const itemsByCategory = new Map();
    for (const category of Object.keys(RSS_FEEDS)) {
      console.log("[cron-fetch] Fetching:", category);
      itemsByCategory.set(category, await getCategoryNews(category));
      summary.categoriesProcessed++;
    }
    console.log("[cron-fetch] Step 3 done, categories:", summary.categoriesProcessed);

    console.log("[cron-fetch] Step 4: claim stories by priority");
    const claimed = new Map();
    for (const category of CATEGORY_PRIORITY) {
      for (const item of itemsByCategory.get(category) ?? []) {
        if (!item.id || claimed.has(item.id)) continue;
        claimed.set(item.id, toStoryRow(item, category));
      }
    }
    console.log("[cron-fetch] Step 4 done, claimed:", claimed.size);

    console.log("[cron-fetch] Step 5: fetchRecentUrls");
    const existingUrls = await fetchRecentUrls(supabase);
    console.log("[cron-fetch] Step 5 done, existingUrls:", existingUrls.size);

    console.log("[cron-fetch] Step 6: fetch in-flight batches");
    const { data: pendingBatches, error: pendingErr } = await supabase
      .from("batches")
      .select("pending_stories")
      .eq("status", "in_progress");
    if (pendingErr) throw pendingErr;
    const inFlightUrls = new Set(
      (pendingBatches ?? []).flatMap((b) => b.pending_stories.map((s) => s.url))
    );
    console.log("[cron-fetch] Step 6 done, inFlightUrls:", inFlightUrls.size);

    const newStories = [...claimed.values()].filter(
      (s) => !existingUrls.has(s.url) && !inFlightUrls.has(s.url)
    );
    summary.newStoriesFound = newStories.length;
    console.log("[cron-fetch] newStoriesFound:", summary.newStoriesFound);

    if (newStories.length > 0 && Date.now() < deadline) {
      console.log("[cron-fetch] Step 7: submit Batch API job");
      const batchId = await submitSummaryBatch(newStories);
      console.log("[cron-fetch] Step 7 done, batchId:", batchId);

      console.log("[cron-fetch] Step 8: insert batch row");
      const { error: insertErr } = await supabase.from("batches").insert({
        id: batchId,
        status: "in_progress",
        pending_stories: newStories,
      });
      if (insertErr) throw insertErr;
      summary.newBatchSubmitted = batchId;
      console.log("[cron-fetch] Step 8 done");

      while (Date.now() < deadline) {
        const { done, briefs } = await pollSummaryBatch(batchId);
        if (done) {
          console.log("[cron-fetch] Batch complete, writing stories");
          await insertFinishedStories(supabase, newStories, briefs);
          const { error: updateErr } = await supabase.from("batches").update({ status: "completed" }).eq("id", batchId);
          if (updateErr) throw updateErr;
          console.log("[cron-fetch] Stories written, batch marked completed");
          break;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }

    console.log("[cron-fetch] Done:", JSON.stringify(summary));
    res.status(200).json(summary);
  } catch (err) {
    console.error("[cron-fetch] CRASHED at summary:", JSON.stringify(summary));
    console.error("[cron-fetch] Error:", err.message);
    console.error("[cron-fetch] Stack:", err.stack);
    res.status(500).json({ error: err.message, stack: err.stack, ...summary });
  }
}
