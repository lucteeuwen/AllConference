import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-[11px] font-bold tracking-[0.2em] text-accent uppercase">404</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        That match, team or page is not part of the CCIW men&apos;s soccer season.
      </p>
      <Link
        href="/matches"
        className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-hover"
      >
        Back to matches
      </Link>
    </div>
  );
}
