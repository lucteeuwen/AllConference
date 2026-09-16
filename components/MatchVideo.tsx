import type { MatchVideo as Video } from "@/lib/types";

/**
 * A specific YouTube video plays inline. Everything else (CCIW Network on
 * Hudl TV, FloCollege, channel pages) opens the provider in a new tab, since
 * those players need a subscription or do not point at one game.
 */
export function MatchVideo({ video, live }: { video: Video; live: boolean }) {
  if (video.embedUrl) {
    return (
      <div className="overflow-hidden rounded-card bg-navy-deep" style={{ aspectRatio: "16 / 9" }}>
        <iframe
          src={video.embedUrl}
          title="Match video"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="size-full border-0"
        />
      </div>
    );
  }

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bc-label inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-[0.72rem] text-white transition hover:opacity-90"
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden="true">
        <path d="M4 2.5v11l9-5.5z" />
      </svg>
      {video.label}
      {live ? <span className="live-dot size-1.5 rounded-full bg-white" /> : null}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
