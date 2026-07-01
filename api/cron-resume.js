import { getSupabaseService } from "./_lib/supabase.js";
import { resumePendingBatch } from "./cron-fetch.js";

// Lightweight safety-net endpoint: resolves any batch that outlasted the
// main cron-fetch time window. Runs in under 5s once Anthropic has finished.
// Configure cron-job.org to call this every 30 minutes.
function isAuthorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  if (!isAuthorised(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const deadline = Date.now() + 25_000; // 25s — well within cron-job.org's 30s timeout
  const supabase = getSupabaseService();

  try {
    const result = await resumePendingBatch(supabase, deadline);
    console.log("[cron-resume] result:", JSON.stringify(result));
    res.status(200).json(result);
  } catch (err) {
    console.error("[cron-resume] error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
