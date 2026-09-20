import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

type Props = {
  title: string;
  subtitle?: string;
  /** Sits opposite the title: a badge, a count, a link. */
  aside?: ReactNode;
  /** Rendered beneath the title band, e.g. a date strip or tab bar. */
  children?: ReactNode;
};

/**
 * The navy band that opens every page. Full-bleed on phones to match the
 * reference, an inset rounded panel once the top nav takes over on desktop.
 */
export function Lockup({ title, subtitle, aside, children }: Props) {
  return (
    <div className="-mx-4 bg-navy px-4 py-4 md:mx-0 md:mt-6 md:rounded-card md:px-6 md:py-5">
      <div className="flex items-center gap-3">
        <LogoMark className="h-7 w-auto shrink-0" title="AllConference" />
        <span aria-hidden="true" className="h-7 w-px shrink-0 bg-white/20" />
        <div className="min-w-0 flex-1">
          <h1 className="bc-title truncate text-[1.05rem] text-white md:text-[1.2rem]">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[0.72rem] text-white/55">{subtitle}</p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
        {/* Phones have no top nav, so the toggle lives in this band instead. */}
        <ThemeToggle tone="onDark" className="shrink-0 md:hidden" />
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

/** The small uppercase label that opens each section, with an optional action. */
export function SectionHeader({
  title,
  action,
  href,
}: {
  title: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 px-1">
      <h2 className="bc-label truncate text-[0.78rem] text-ink">{title}</h2>
      {action && href ? (
        <a
          href={href}
          className="shrink-0 text-[0.75rem] font-bold text-accent hover:underline"
        >
          {action}
        </a>
      ) : null}
    </div>
  );
}
