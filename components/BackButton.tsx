"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { canGoBackInApp } from "@/lib/navigation";

type Props = {
  /** Where to go when the visitor arrived directly, with no earlier page of ours to return to. */
  fallbackHref: string;
  label: string;
  children: ReactNode;
};

/**
 * Returns to whatever page the visitor came from, filters and scroll included.
 * Still a real link to `fallbackHref`, so opening it in a new tab works.
 */
export function BackButton({ fallbackHref, label, children }: Props) {
  const router = useRouter();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (canGoBackInApp()) router.back();
    else router.push(fallbackHref);
  };

  return (
    <Link
      href={fallbackHref}
      onClick={onClick}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
    >
      {children}
    </Link>
  );
}
