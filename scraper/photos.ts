import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchWithRetry } from "./http";
import { IMAGE_EXTENSIONS, mediaType } from "./images";

/**
 * Copies a player's headshot into the public `player-photos` bucket, cropped
 * square from the top the way SIDEARM's own roster cards ask for it. The photo
 * is only downloaded again when the school's URL for it changes, so a school's
 * server sees one request per headshot instead of one per visitor.
 */

export const PHOTO_BUCKET = "player-photos";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Twice the 128px the player page shows, for sharp screens. */
const PHOTO_SIZE = 256;
/** A real 256px headshot is several KB; anything this small is a placeholder. */
const MIN_BYTES = 1024;

export type StoredPhoto = { photo_url: string | null; photo_source_url: string | null };

/** SIDEARM resizes on the fly: ask it for the square crop we store. */
export function photoRequestUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  url.search = `?width=${PHOTO_SIZE}&height=${PHOTO_SIZE}&mode=crop&anchor=topcenter`;
  return url.href;
}

/** The storage path inside the bucket that a public URL from `cachePhoto` points at. */
export function storedPhotoPath(publicUrl: string | null): string | null {
  const marker = `/${PHOTO_BUCKET}/`;
  const path = publicUrl?.split("?")[0].split(marker)[1];
  return path ? decodeURIComponent(path) : null;
}

export async function cachePhoto(
  db: SupabaseClient,
  playerId: string,
  sourceUrl: string,
): Promise<string | null> {
  const response = await fetchWithRetry(photoRequestUrl(sourceUrl));
  if (!response.ok) return null;

  const contentType = mediaType(response);
  if (!PHOTO_TYPES.has(contentType)) return null;

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < MIN_BYTES) return null;

  const path = `${playerId}.${IMAGE_EXTENSIONS[contentType]}`;
  const { error } = await db.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw error;

  const { data } = db.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  // The URL changes with every upload, so browsers and the CDN can keep it for a year.
  return `${data.publicUrl}?v=${Date.now().toString(36)}`;
}

/**
 * What to store for a player's photo. Nothing is downloaded while the school's
 * URL is the one we already cached. When a download fails, the previous photo
 * (or the school's own URL on rows from before the cache) stays in place and
 * the next run tries again.
 */
export async function resolvePhoto(
  db: SupabaseClient,
  playerId: string,
  sourceUrl: string | null,
  previous: StoredPhoto | undefined,
  options: { download: boolean; onWarning: (message: string) => void },
): Promise<StoredPhoto> {
  if (!sourceUrl) return { photo_url: null, photo_source_url: null };

  const keep: StoredPhoto = {
    photo_url: previous?.photo_url ?? null,
    photo_source_url: previous?.photo_source_url ?? null,
  };
  if (keep.photo_url && keep.photo_source_url === sourceUrl) return keep;
  if (!options.download) return keep;

  try {
    const url = await cachePhoto(db, playerId, sourceUrl);
    if (url) return { photo_url: url, photo_source_url: sourceUrl };
    options.onWarning(`WARN photo ${playerId}: no usable image at ${sourceUrl}`);
  } catch (error) {
    options.onWarning(`WARN photo ${playerId}: ${(error as Error).message}`);
  }
  return keep;
}
