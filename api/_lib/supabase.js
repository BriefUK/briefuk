import { createClient } from "@supabase/supabase-js";

let anonClient, serviceClient;

// Public-read client (RLS allows SELECT to anon/authenticated). Used by the
// request-time read paths (api/news.js, api/brit-bit.js) — safe even if this
// key ends up client-side, since it can't write.
export function getSupabaseAnon() {
  if (anonClient) return anonClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY are not set");
  anonClient = createClient(url, key, { auth: { persistSession: false } });
  return anonClient;
}

// Privileged client — bypasses RLS, required for any INSERT/UPDATE. Used
// only by the cron jobs; never import from a frontend-reachable path.
export function getSupabaseService() {
  if (serviceClient) return serviceClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  serviceClient = createClient(url, key, { auth: { persistSession: false } });
  return serviceClient;
}
