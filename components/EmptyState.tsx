import Link from "next/link";

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyState({ title, body, actionLabel, actionHref }: Props) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.6-3.6" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{body}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
