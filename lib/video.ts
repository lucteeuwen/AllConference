import type { MatchVideo } from "@/lib/types";

/**
 * Turns the free-form "video" link a school puts on a game into something the
 * match page can show. Only a specific YouTube video can be embedded: CCIW
 * Network (Hudl TV) and FloCollege are subscription players, and channel links
 * do not point at one game.
 */

const YOUTUBE_ID = /^[\w-]{11}$/;

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;

  const fromQuery = url.searchParams.get("v");
  if (fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery;

  const [kind, id] = url.pathname.split("/").filter(Boolean);
  if (["live", "embed", "shorts"].includes(kind) && id && YOUTUBE_ID.test(id)) return id;
  return null;
}

export function classifyVideo(raw: string | null | undefined): MatchVideo | undefined {
  if (!raw) return undefined;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;

  const host = url.hostname.replace(/^www\./, "");
  const href = url.toString();

  const id = youtubeId(url);
  if (id) {
    return {
      url: href,
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      label: "Watch on YouTube",
    };
  }
  if (host.endsWith("youtube.com")) {
    return { url: href, provider: "youtube", label: "Watch on YouTube" };
  }
  if (host === "cciwnetwork.com") {
    return { url: href, provider: "hudl", label: "Watch on CCIW Network" };
  }
  // Conference networks on Hudl TV all share the `?B=<broadcast>` link shape.
  if (host.endsWith("hudl.com") || url.searchParams.has("B") || host.endsWith("network.com")) {
    return { url: href, provider: "hudl", label: "Watch the stream" };
  }
  if (host.includes("flosports") || host.includes("flocollege")) {
    return { url: href, provider: "flo", label: "Watch on FloCollege" };
  }
  if (host.endsWith("boxcast.tv")) {
    return { url: href, provider: "other", label: "Watch on BoxCast" };
  }
  if (host.endsWith("espn.com")) {
    return { url: href, provider: "other", label: "Watch on ESPN" };
  }
  return { url: href, provider: "other", label: "Watch video" };
}
