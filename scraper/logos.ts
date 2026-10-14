import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { fetchWithRetry } from "./http";

/**
 * Copies a team's logo into the public `team-logos` bucket. It only downloads
 * again when the source URL in the feeds changes, so the schools' servers see
 * one request per logo per season.
 *
 * Raster logos are shrunk to a small WebP here, once, so the site can serve
 * them as they are instead of paying for Vercel image transformations.
 */

const RASTER_TYPES = new Set(["image/png", "image/webp", "image/jpeg", "image/gif"]);

/** The largest badge is 60px, so this covers it on 2x screens. */
const LOGO_SIZE = 128;

/**
 * The logo to cache from the URLs the feeds offer. The stored one wins while
 * a feed still offers it; otherwise the pick must not depend on which feed
 * answered first, or every run would upload under a new URL.
 */
export function pickLogoSource(current: string | null, candidates: Iterable<string>): string | null {
  const sorted = [...candidates].sort();
  if (current && sorted.includes(current)) return current;
  return sorted[0] ?? null;
}

/** The bytes and type to store, or null for something that is not a logo. */
export async function prepareLogo(
  bytes: Uint8Array,
  contentType: string,
): Promise<{ bytes: Uint8Array; contentType: string; extension: string } | null> {
  // SIDEARM serves a 1x1 placeholder for missing logos.
  if (bytes.byteLength < 200) return null;
  if (contentType === "image/svg+xml") return { bytes, contentType, extension: "svg" };
  if (!RASTER_TYPES.has(contentType)) return null;

  const webp = await sharp(bytes)
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  return { bytes: new Uint8Array(webp), contentType: "image/webp", extension: "webp" };
}

/** Same bytes, same URL, so re-uploading an unchanged logo costs nothing. */
export function logoVersion(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 10);
}

export async function cacheLogo(
  db: SupabaseClient,
  slug: string,
  sourceUrl: string,
): Promise<string | null> {
  const response = await fetchWithRetry(sourceUrl);
  if (!response.ok) return null;

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
  const logo = await prepareLogo(new Uint8Array(await response.arrayBuffer()), contentType);
  if (!logo) return null;

  const path = `${slug}.${logo.extension}`;
  const { error } = await db.storage
    .from("team-logos")
    // The URL carries a content hash, so it can be cached for good.
    .upload(path, logo.bytes, { contentType: logo.contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw error;

  const { data } = db.storage.from("team-logos").getPublicUrl(path);
  return `${data.publicUrl}?v=${logoVersion(logo.bytes)}`;
}
