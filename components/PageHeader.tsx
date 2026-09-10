import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  /** Rendered under the title band, e.g. a date strip or split toggle. */
  children?: ReactNode;
};

/**
 * The navy band at the top of each page. Full-bleed on phones to match the
 * mockup, an inset rounded panel once the top nav takes over on desktop.
 */
export function PageHeader({ title, subtitle, children }: Props) {
  return (
    <div className="-mx-4 mb-5 bg-navy px-4 pt-5 pb-4 md:mx-0 md:mt-6 md:rounded-card md:px-6 md:pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight text-white">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-[13px] text-white/60">{subtitle}</p> : null}
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white/80 uppercase">
          NCAA DIII
        </span>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
