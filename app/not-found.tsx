import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="bc-score text-[3.5rem] leading-none font-black text-accent">404</p>
      <h1 className="bc-title mt-2 text-[2.2rem] leading-none text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        That match, team or page is not part of this CCIW soccer season.
      </p>
      <Link
        href="/"
        className="bc-label mt-6 rounded-control bg-accent px-5 py-2.5 text-[0.9rem] text-on-accent transition hover:bg-accent-hover"
      >
        Back to the scores
      </Link>
    </div>
  );
}
