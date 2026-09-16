import "server-only";
import { createClient } from "@supabase/supabase-js";

/** How long a Supabase read is served from Next's data cache, in seconds. */
export const DATA_REVALIDATE_SECONDS = 60;

/**
 * Read-only client for server components. The anon key can only select (RLS),
 * and nothing here needs a user session. Reads go through `fetch` with a
 * revalidate window, so pages share one cached copy per minute instead of
 * querying the database on every request.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, next: { revalidate: DATA_REVALIDATE_SECONDS, tags: ["season"] } }),
    },
  });
}
