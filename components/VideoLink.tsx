"use client";

import type { MouseEvent, ReactNode } from "react";

/**
 * Opens in a new tab by default (desktop, no-JS, pre-hydration). On narrow
 * screens an unmodified click navigates the current tab instead.
 */
export function VideoLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    event.preventDefault();
    window.location.assign(href);
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {children}
    </a>
  );
}
