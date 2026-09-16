import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchWithRetry } from "./http";

/**
 * Copies a team's logo into the public `team-logos` bucket. It only downloads
 * again when the source URL in the feeds changes, so the schools' servers see
 * one request per logo per season.
 */

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

export async function cacheLogo(
  db: SupabaseClient,
  slug: string,
  sourceUrl: string,
): Promise<string | null> {
  const response = await fetchWithRetry(sourceUrl);
  if (!response.ok) return null;

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
  const extension = EXTENSIONS[contentType];
  if (!extension) return null;

  const bytes = new Uint8Array(await response.arrayBuffer());
  // SIDEARM serves a 1x1 placeholder for missing logos.
  if (bytes.byteLength < 200) return null;

  const path = `${slug}.${extension}`;
  const { error } = await db.storage
    .from("team-logos")
    .upload(path, bytes, { contentType, upsert: true, cacheControl: "86400" });
  if (error) throw error;

  const { data } = db.storage.from("team-logos").getPublicUrl(path);
  // The version parameter busts caches when a school swaps its logo.
  return `${data.publicUrl}?v=${Date.now().toString(36)}`;
}
