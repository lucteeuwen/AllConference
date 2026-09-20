import type { MatchVideo as Video } from "@/lib/types";

/**
 * A specific YouTube video plays inline. Everything else opens the provider in
 * a new tab, since those players need a subscription. A link that isn't this
 * game's own stream is presented as the platform's page, with a note, rather
 * than as the game.
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

  const link = (
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
      {live && video.exact ? <span className="live-dot size-1.5 rounded-full bg-white" /> : null}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );

  if (video.exact) return link;
  return (
    <div className="flex flex-col items-start gap-2.5">
      {link}
      <p className="text-[0.75rem] text-ink-muted">
        We can&apos;t confirm the exact stream for this match, so this opens {video.platform}. Look for the
        game there.
      </p>
    </div>
  );
}
