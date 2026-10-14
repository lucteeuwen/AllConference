import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchWithRetry = vi.hoisted(() => vi.fn());
vi.mock("../http", () => ({ fetchWithRetry }));

import { cachePhoto, photoRequestUrl, resolvePhoto, storedPhotoPath } from "../photos";

const SOURCE = "https://athletics.wheaton.edu/images/2026/8/26/Huber_David.jpg";

function fakeDb(uploadError: Error | null = null) {
  const upload = vi.fn(async () => ({ error: uploadError }));
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/player-photos/${path}` },
  }));
  const db = { storage: { from: () => ({ upload, getPublicUrl }) } } as unknown as SupabaseClient;
  return { db, upload };
}

const image = (type = "image/jpeg", bytes = 4000) =>
  new Response(new Uint8Array(bytes), { headers: { "content-type": type } });

const options = () => ({ download: true, onWarning: vi.fn() });

beforeEach(() => {
  fetchWithRetry.mockReset();
});

describe("photoRequestUrl", () => {
  it("asks SIDEARM for a 256px square crop from the top", () => {
    expect(photoRequestUrl(SOURCE)).toBe(`${SOURCE}?width=256&height=256&mode=crop&anchor=topcenter`);
  });
});

describe("storedPhotoPath", () => {
  it("reads the bucket path back out of a public URL", () => {
    expect(
      storedPhotoPath("https://x.supabase.co/storage/v1/object/public/player-photos/2026-wheaton-david.jpg?v=abc"),
    ).toBe("2026-wheaton-david.jpg");
  });

  it("ignores URLs that are not in the bucket", () => {
    expect(storedPhotoPath(SOURCE)).toBeNull();
    expect(storedPhotoPath(null)).toBeNull();
  });
});

describe("cachePhoto", () => {
  it("uploads the image and returns a versioned public URL", async () => {
    fetchWithRetry.mockResolvedValue(image("image/jpeg; charset=binary"));
    const { db, upload } = fakeDb();
    const url = await cachePhoto(db, "2026-wheaton-david", SOURCE);
    expect(url).toMatch(/player-photos\/2026-wheaton-david\.jpg\?v=\w+$/);
    expect(upload).toHaveBeenCalledWith("2026-wheaton-david.jpg", expect.any(Uint8Array), {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "31536000",
    });
  });

  it("skips a missing page, a non-photo type and a placeholder-sized body", async () => {
    const { db, upload } = fakeDb();
    fetchWithRetry.mockResolvedValueOnce(new Response("", { status: 404 }));
    fetchWithRetry.mockResolvedValueOnce(image("image/svg+xml"));
    fetchWithRetry.mockResolvedValueOnce(image("image/jpeg", 100));
    for (let i = 0; i < 3; i++) expect(await cachePhoto(db, "id", SOURCE)).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("throws when the upload fails", async () => {
    fetchWithRetry.mockResolvedValue(image());
    const { db } = fakeDb(new Error("bucket missing"));
    await expect(cachePhoto(db, "id", SOURCE)).rejects.toThrow("bucket missing");
  });
});

describe("resolvePhoto", () => {
  const cached = { photo_url: "https://x.supabase.co/player-photos/a.jpg?v=1", photo_source_url: SOURCE };

  it("clears the photo when the school no longer has one", async () => {
    const { db } = fakeDb();
    expect(await resolvePhoto(db, "id", null, cached, options())).toEqual({ photo_url: null, photo_source_url: null });
  });

  it("does not download again while the school's URL is unchanged", async () => {
    const { db } = fakeDb();
    expect(await resolvePhoto(db, "id", SOURCE, cached, options())).toEqual(cached);
    expect(fetchWithRetry).not.toHaveBeenCalled();
  });

  it("downloads a new player's photo and a changed one", async () => {
    fetchWithRetry.mockImplementation(async () => image());
    const { db } = fakeDb();
    for (const previous of [undefined, { ...cached, photo_source_url: "https://old.example/a.jpg" }]) {
      const result = await resolvePhoto(db, "2026-wheaton-david", SOURCE, previous, options());
      expect(result.photo_source_url).toBe(SOURCE);
      expect(result.photo_url).toContain("/player-photos/2026-wheaton-david.jpg?v=");
    }
  });

  it("caches rows saved before the cache existed, which hold the school's URL", async () => {
    fetchWithRetry.mockResolvedValue(image());
    const { db } = fakeDb();
    const result = await resolvePhoto(db, "id", SOURCE, { photo_url: SOURCE, photo_source_url: null }, options());
    expect(result.photo_url).toContain("/player-photos/");
  });

  it("keeps the previous photo and warns when the download fails", async () => {
    fetchWithRetry.mockRejectedValue(new Error("timeout"));
    const { db } = fakeDb();
    const opts = options();
    const previous = { ...cached, photo_source_url: "https://old.example/a.jpg" };
    expect(await resolvePhoto(db, "id", SOURCE, previous, opts)).toEqual(previous);
    expect(opts.onWarning).toHaveBeenCalledWith("WARN photo id: timeout");
  });

  it("downloads nothing in a dry run", async () => {
    const { db } = fakeDb();
    expect(await resolvePhoto(db, "id", SOURCE, undefined, { download: false, onWarning: vi.fn() })).toEqual({
      photo_url: null,
      photo_source_url: null,
    });
    expect(fetchWithRetry).not.toHaveBeenCalled();
  });
});
