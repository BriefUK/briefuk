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
    // Attempt to resolve any pending batch, but only spend 8s on it.
    // If the batch is already done on Anthropic's side this resolves in <2s.
    // If it's still processing, bail immediately and let /api/cron-resume
    // handle it — don't let it eat the whole time budget meant for RSS + dedup.
    const resumeDeadline = Date.now() + 8_000;
    summary.resumedBatch = await resumePendingBatch(supabase, resumeDeadline);
    console.log("[cron-fetch] resumedBatch:", JSON.stringify(summary.resumedBatch));

    // ── Step 1: RSS fetch (parallel) ─────────────────────────────────────
    console.log("[cron-fetch] STEP 1: fetching RSS for all categories in parallel");
    const categoryList = Object.keys(RSS_FEEDS);
    const results = await Promise.all(categoryList.map((cat) => getCategoryNews(cat)));
    const itemsByCategory = new Map(categoryList.map((cat, i) => [cat, results[i]]));
    summary.categoriesProcessed = categoryList.length;
    let totalRss = 0;
    for (const [cat, items] of itemsByCategory) {
      console.log(`  [rss] ${cat}: ${items.length} stories`);
      totalRss += items.length;
    }
    console.log(`[cron-fetch] STEP 1 done: ${totalRss} total stories across all categories`);

    // ── Step 2: priority-claim one URL per story ──────────────────────────
    console.log("[cron-fetch] STEP 2: claiming stories by category priority");
    const claimed = new Map();
    for (const category of CATEGORY_PRIORITY) {
      for (const item of itemsByCategory.get(category) ?? []) {
        if (!item.id || claimed.has(item.id)) continue;
        claimed.set(item.id, toStoryRow(item, category));
      }
    }
    console.log(`[cron-fetch] STEP 2 done: ${claimed.size} unique stories claimed`);

    // ── Step 3: deduplication against Supabase ────────────────────────────
    console.log("[cron-fetch] STEP 3: fetching existing URLs from Supabase (last 30 days)");
    const existingUrls = await fetchRecentUrls(supabase);
    console.log(`[cron-fetch] STEP 3 done: ${existingUrls.size} URLs already in Supabase`);

    // Log a sample to verify URL format matches
    const sampleClaimed = [...claimed.keys()].slice(0, 2);
    const sampleExisting = [...existingUrls].slice(0, 2);
    console.log("[cron-fetch] sample claimed URLs:", JSON.stringify(sampleClaimed));
    console.log("[cron-fetch] sample existing URLs:", JSON.stringify(sampleExisting));

    const { data: pendingBatches, error: pendingErr } = await supabase
      .from("batches")
      .select("pending_stories")
      .eq("status", "in_progress");
    if (pendingErr) throw pendingErr;
    const inFlightUrls = new Set(
      (pendingBatches ?? []).flatMap((b) => b.pending_stories.map((s) => s.url))
    );
    console.log(`[cron-fetch] in-flight URLs (pending batches): ${inFlightUrls.size}`);

    const newStories = [...claimed.values()].filter(
      (s) => !existingUrls.has(s.url) && !inFlightUrls.has(s.url)
    );
    summary.newStoriesFound = newStories.length;
    console.log(`[cron-fetch] DEDUP RESULT: ${claimed.size} claimed → ${existingUrls.size} existing → ${inFlightUrls.size} in-flight → ${newStories.length} genuinely new`);

    if (newStories.length === 0) {
      console.log("[cron-fetch] nothing new — checking if dedup is over-aggressive:");
      // Sample overlap check: are claimed URLs actually in existingUrls?
      let overlapCount = 0;
      for (const s of claimed.values()) {
        if (existingUrls.has(s.url)) overlapCount++;
      }
      console.log(`[cron-fetch]   ${overlapCount} of ${claimed.size} claimed URLs match existingUrls`);
      console.log(`[cron-fetch]   ${inFlightUrls.size} blocked by in-flight batches`);
    }

    // ── Step 4: batch submit ──────────────────────────────────────────────
    if (newStories.length > 0 && Date.now() < deadline) {
      console.log(`[cron-fetch] STEP 4: submitting ${newStories.length} stories to Claude Batch API`);
      const batchId = await submitSummaryBatch(newStories);
      console.log("[cron-fetch] STEP 4 done: batch submitted:", batchId);

      const { error: insertErr } = await supabase.from("batches").insert({
        id: batchId,
        status: "in_progress",
        pending_stories: newStories,
      });
      if (insertErr) throw insertErr;
      summary.batchSubmitted = batchId;

      // ── Step 5: poll & write ──────────────────────────────────────────
      console.log("[cron-fetch] STEP 5: polling for batch completion");
      let polls = 0;
      while (Date.now() < deadline) {
        const { done, briefs } = await pollSummaryBatch(batchId);
        polls++;
        if (done) {
          console.log(`[cron-fetch] STEP 5: batch done after ${polls} poll(s), writing stories`);
          const written = await insertFinishedStories(supabase, newStories, briefs);
          const { error: updateErr } = await supabase.from("batches").update({ status: "completed" }).eq("id", batchId);
          if (updateErr) throw updateErr;
          console.log(`[cron-fetch] STEP 5 done: ${written} stories written to Supabase`);
          summary.written = written;
          break;
        }
        console.log(`[cron-fetch]   poll ${polls}: still in_progress, waiting ${POLL_INTERVAL_MS}ms`);
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      if (!summary.written) {
        console.log("[cron-fetch] STEP 5: time budget exhausted — cron-resume will finish this batch");
      }
    }

    console.log("[cron-fetch] FINAL SUMMARY:", JSON.stringify({
      ...summary,
      rssTotal: totalRss,
      uniqueClaimed: claimed.size,
      existingInDb: existingUrls.size,
      inFlight: inFlightUrls.size,
    }));
    res.status(200).json({ ...summary, rssTotal: totalRss, uniqueClaimed: claimed.size, existingInDb: existingUrls.size });
  } catch (err) {
    console.error("[cron-fetch] error:", err.message, err.stack);
    res.status(500).json({ error: err.message, ...summary });
  }
}
