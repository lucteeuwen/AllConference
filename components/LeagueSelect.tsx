"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { leagueFor, leagueGroups, leagueLabel } from "@/lib/leagues";
import { switchSportHref } from "@/lib/sport";
import { useSport } from "@/lib/use-sport";

type Props = {
  /**
   * "onDark" sits in the navy desktop header. "lockup" is the page band on
   * phones: its menu spans the band, so it needs a positioned ancestor (the
   * Lockup's title row).
   */
  tone?: "onDark" | "lockup";
  className?: string;
};

/**
 * The league menu: the current league as a button, and under it every league
 * grouped by Men's and Women's. Each entry is a link to the same section of
 * that league, so picking one is a normal navigation.
 */
export function LeagueSelect({ tone = "onDark", className = "" }: Props) {
  const pathname = usePathname();
  const sport = useSport();
  const current = leagueFor(sport);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // A navigation (the link just clicked, or any other) leaves the menu shut.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Arrow keys walk the links, starting from the button.
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = Array.from(root.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    if (links.length === 0) return;
    event.preventDefault();
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    links[(index + step + links.length) % links.length].focus();
  };

  const lockup = tone === "lockup";
  const panelAt = lockup ? "inset-x-0 mt-3" : "left-0 mt-2 w-72 max-w-[calc(100vw-2rem)]";
  const chrome = lockup
    ? "-ml-2 max-w-full px-2 py-1 text-[1.05rem] text-white hover:bg-white/10"
    : "px-3 py-1.5 text-[15px] text-white hover:bg-white/10";

  return (
    <div ref={root} onKeyDown={onMenuKeyDown} className={`${lockup ? "min-w-0" : "relative"} ${className}`}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" || open) return;
          event.preventDefault();
          setOpen(true);
        }}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`League: ${leagueLabel(current)}`}
        className={`flex items-center gap-1.5 rounded-control font-bold tracking-tight transition ${chrome}`}
      >
        <span className="truncate">{leagueLabel(current)}</span>
        <svg
          viewBox="0 0 16 16"
          className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className={`absolute top-full ${panelAt} z-50 overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-[0_20px_40px_-20px_rgba(16,24,40,0.4)]`}>
          <div className="max-h-80 overflow-y-auto py-1">
            {leagueGroups().map((group) => (
              <section key={group.sport} aria-label={group.label}>
                <h2 className="bc-label px-4 pt-3 pb-1 text-[0.68rem] text-ink-faint">{group.label}</h2>
                {group.leagues.map((league) => {
                  const selected = league.sport === current.sport && league.id === current.id;
                  return (
                    <Link
                      key={`${league.sport}-${league.id}`}
                      href={switchSportHref(pathname, league.sport)}
                      aria-current={selected ? "true" : undefined}
                      className="flex items-center gap-3 px-4 py-2 transition hover:bg-ground focus-visible:bg-ground"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">{league.name}</span>
                        <span className="block truncate text-[0.72rem] text-ink-muted">{league.fullName}</span>
                      </span>
                      {selected ? (
                        <svg
                          viewBox="0 0 12 12"
                          className="size-3.5 shrink-0 text-accent"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          aria-hidden="true"
                        >
                          <path d="M2 6.2l2.6 2.6L10 3.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </Link>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
