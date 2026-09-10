import Link from "next/link";
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  /** Removes the inner padding for cards that own their own layout. */
  flush?: boolean;
};

/** The white rounded panel that carries almost everything in the app. */
export function Card({ children, className = "", flush = false }: CardProps) {
  return (
    <div
      className={`rounded-card border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(16,24,40,0.24)] ${
        flush ? "" : "p-4"
      } ${className}`}
    >
      {children}
    </div>
  );
}

type SectionHeaderProps = {
  title: string;
  href?: string;
  hint?: string;
};

export function SectionHeader({ title, href, hint }: SectionHeaderProps) {
  const heading = (
    <div className="flex min-w-0 items-baseline gap-2">
      <h2 className="truncate text-[17px] font-bold text-ink">{title}</h2>
      {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
    </div>
  );

  if (!href) {
    return <div className="mb-3 flex items-center justify-between px-1">{heading}</div>;
  }

  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      {heading}
      <Link
        href={href}
        className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition hover:border-accent hover:text-accent"
        aria-label={`See all ${title}`}
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}
