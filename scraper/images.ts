/** File extension for each image type the scraper copies into Supabase Storage. */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

/** The bare media type of a Content-Type header, without parameters like charset. */
export function mediaType(response: Response): string {
  return (response.headers.get("content-type") ?? "").split(";")[0].trim();
}
