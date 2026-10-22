"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { SlidingSegments } from "@/components/SlidingSegments";
import { leagueFor, leagueGroups, leagueLabel } from "@/lib/leagues";
import { switchSportHref } from "@/lib/sport";
import { currentTheme, setTheme, type Theme } from "@/lib/theme";
import { useSport } from "@/lib/use-sport";

type Props = {
  className?: string;
};

/** The current league as plain text, e.g. "CCIW Men's Soccer". Renders nothing when it equals `unless`. */
export function LeagueName({ className = "", unless }: { className?: string; unless?: string }) {
  const label = leagueLabel(leagueFor(useSport()));
  if (label === unless) return null;
  return <span className={className}>{label}</span>;
}

const themes: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * The site menu: the league to show (every league, grouped by Men's and
 * Women's, each a link to that league; see `switchSportHref`) and light or dark.
 *
 * The panel is portalled to the body with fixed positioning, so no band's
 * overflow or an animated section's stacking context can cover it.
 */
export function SiteMenu({ className = "" }: Props) {
  const pathname = usePathname();
  const sport = useSport();
  const current = leagueFor(sport);
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState<Theme>("light");
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // A navigation (the link just clicked, or any other) leaves the menu shut.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  const measure = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    setPlace({ top: rect.bottom + 8, right: Math.max(16, window.innerWidth - rect.right) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
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

  // Arrow keys walk the links.
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = Array.from(panel.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    if (links.length === 0) return;
    event.preventDefault();
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    links[(index + step + links.length) % links.length].focus();
  };

  const toggle = () => {
    if (!open) setThemeState(currentTheme());
    setOpen((value) => !value);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" || open) return;
          event.preventDefault();
          toggle();
        }}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Menu. League: ${leagueLabel(current)}`}
        title="League and appearance"
        className={`flex size-9 shrink-0 items-center justify-center rounded-control border border-white/20 bg-white/10 text-white transition hover:bg-white/20 ${className}`}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && place
        ? createPortal(
            <>
              <div aria-hidden="true" className="fixed inset-0 z-[60] bg-navy-deep/40 md:bg-transparent" />
              <div
                ref={panel}
                onKeyDown={onMenuKeyDown}
                className="bc-card bc-shadow-lift fixed z-[61] overflow-hidden"
                style={{ top: place.top, right: place.right, width: "min(20rem, calc(100vw - 2rem))" }}
              >
                <div className="max-h-[min(28rem,calc(100dvh-8rem))] overflow-y-auto">
                  <p className="bc-label border-b border-line px-4 pt-3.5 pb-2 text-[1.05rem] text-ink">League</p>
                  {leagueGroups().map((group) => (
                    <section key={group.sport} aria-label={group.label} className="py-1">
                      <h2 className="bc-label px-4 pt-2 pb-1 text-[0.72rem] text-ink-faint">{group.label}</h2>
                      {group.leagues.map((league) => {
                        const selected = league.sport === current.sport && league.id === current.id;
                        return (
                          <Link
                            key={`${league.sport}-${league.id}`}
                            href={switchSportHref(pathname, league.sport)}
                            aria-current={selected ? "true" : undefined}
                            className={`flex items-center gap-3 border-l-4 px-4 py-2 transition hover:bg-ground focus-visible:bg-ground ${
                              selected ? "border-accent bg-accent-soft/60" : "border-transparent"
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="bc-label block text-[0.95rem] text-ink">{league.name}</span>
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

                  <div className="border-t border-line px-4 pt-3 pb-4">
                    <p className="bc-label mb-1 text-[1.05rem] text-ink">Appearance</p>
                    <SlidingSegments
                      label="Appearance"
                      options={themes}
                      value={theme}
                      onChange={(value) => {
                        setTheme(value);
                        setThemeState(value);
                      }}
                    />
                  </div>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
