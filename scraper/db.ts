import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The scraper writes with the service-role key, which bypasses RLS. A dry run
 * only reads, so the public anon key is enough there.
 */
export function createDb(readOnly: boolean): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = readOnly
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase credentials: set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and " +
        (readOnly ? "an anon or service-role key." : "SUPABASE_SERVICE_ROLE_KEY."),
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Awaits a query and throws on error, so call sites read as plain values. */
export async function must<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  what: string,
): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data as T;
}

export async function upsertInChunks(
  db: SupabaseClient,
  table: string,
  rows: object[],
  onConflict: string,
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await must(db.from(table).upsert(rows.slice(i, i + size), { onConflict }), `upsert ${table}`);
  }
}
