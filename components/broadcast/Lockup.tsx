import type { ReactNode } from "react";
import { Headline } from "@/components/broadcast/Headline";
import { LogoMark } from "@/components/Logo";
import { LeagueName, SiteMenu } from "@/components/SiteMenu";

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
 * Phones have no top nav, so the band names the league above the title and
 * carries the site menu.
 */
export function Lockup({ title, subtitle, aside, children }: Props) {
  return (
    <div className="bc-chrome bc-lockup -mx-4 bg-navy px-4 py-4 md:mx-0 md:mt-6 md:rounded-card md:px-6 md:py-5">
      <div className="relative flex items-center gap-3">
        <LogoMark className="h-7 w-auto shrink-0" title="AllConference" />
        <span aria-hidden="true" className="h-7 w-px shrink-0 bg-white/20" />
        <div className="min-w-0 flex-1">
          <LeagueName
            unless={title}
            className="bc-label mb-1 block truncate text-[0.72rem] text-white/70 md:hidden"
          />
          <Headline text={title} className="bc-title break-words text-white" />
          {subtitle ? (
            <p className="bc-lockup-sub truncate text-[0.72rem] text-white/55">{subtitle}</p>
          ) : null}
        </div>
        {aside ? <div className="bc-lockup-aside shrink-0">{aside}</div> : null}
        {/* Phones have no top nav, so the menu lives in this band instead. */}
        <SiteMenu className="md:hidden" />
      </div>
      {children ? <div className="relative mt-4">{children}</div> : null}
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
    <div className="bc-section mb-3 flex items-baseline justify-between gap-4 px-1">
      <Headline as="h2" text={title} className="bc-label bc-section-title truncate text-ink" />
      {action && href ? (
        <a
          href={href}
          className="bc-section-action shrink-0 text-[0.75rem] font-bold text-accent hover:underline"
        >
          {action}
        </a>
      ) : null}
    </div>
  );
}
