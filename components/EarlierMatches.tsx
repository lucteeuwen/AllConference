"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from "react";

type Props = {
  /** Matches inside the collapsed days, for the button label. */
  count: number;
  open: boolean;
  /** The URL each state lives at, so a filter change keeps the choice. */
  openHref: string;
  closeHref: string;
  /** The earlier days, rendered by the server and always present in the page. */
  children: ReactNode;
};

const DURATION_MS = 450;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The boundary between finished days and the days ahead. The earlier days sit
 * above the button. Opening reveals only the strip the reader can see above it,
 * the most recent earlier days, bringing the button to mid-screen with today's
 * matches below; the rest of the list then takes over invisibly (see
 * `expandInPlace`), so nothing ever scrolls past during the motion.
 *
 * Without JavaScript the button is an ordinary link to `?past=1`.
 */
export function EarlierMatches({ count, open, openHref, closeHref, children }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isOpen, setOpen] = useOptimistic(open);
  const [closedAtStart] = useState(!open);

  const region = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const stopListening = useRef<(() => void) | null>(null);
  // The state the region is showing or heading to, whatever the props say yet.
  const showing = useRef(open);

  const cancel = useCallback(() => {
    cancelAnimationFrame(frame.current);
    stopListening.current?.();
    stopListening.current = null;
  }, []);

  /** Pins the region to a resting height with no motion and no scroll change. */
  const snap = useCallback(
    (opening: boolean) => {
      cancel();
      if (region.current) region.current.style.height = opening ? "auto" : "0px";
    },
    [cancel],
  );

  /**
   * Swaps the clipped strip for the full list. The region is bottom-aligned, so
   * the strip's content is already the bottom of the full content; scrolling by
   * the height that appears above it leaves every pixel on screen where it was.
   */
  const expandInPlace = () => {
    const regionEl = region.current;
    const innerEl = inner.current;
    if (!regionEl || !innerEl) return;
    const shown = regionEl.getBoundingClientRect().height;
    regionEl.style.height = "auto";
    const extra = innerEl.offsetHeight - shown;
    if (extra > 0) window.scrollBy({ top: extra, left: 0, behavior: "instant" });
  };

  const run = (opening: boolean) => {
    const regionEl = region.current;
    const innerEl = inner.current;
    const toggleEl = toggle.current;
    if (!regionEl || !innerEl || !toggleEl) return;

    cancel();

    const box = toggleEl.getBoundingClientRect();
    const full = innerEl.offsetHeight;
    // The pinned header on the Matches page; elsewhere the desktop nav (hidden, so 0, on phones).
    const header = document.getElementById("matches-sticky") ?? document.querySelector("header");
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0;

    const scale = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--motion-scale"),
    );
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : DURATION_MS * (Number.isNaN(scale) ? 1 : scale);

    let from: number;
    let to: number;
    // Page scroll as a function of progress 0..1, chosen so the button ends where we want it.
    let scrollAt: (progress: number) => number;
    let scrollEnd: number;

    if (opening) {
      // Reveal the strip that fills the space above the button and scroll only
      // as far as needed to bring the button to the middle of what the reader
      // can see: below the pinned header, above the phone tab bar.
      const tabBar = document.querySelector<HTMLElement>('nav[aria-label="Primary"]');
      const bottom =
        tabBar && getComputedStyle(tabBar).display !== "none"
          ? tabBar.getBoundingClientRect().top
          : window.innerHeight;
      const targetY = (headerBottom + bottom) / 2 - box.height / 2;
      const startScroll = window.scrollY;
      from = 0;
      to = Math.min(full, Math.max(0, targetY - headerBottom));
      const delta = Math.max(0, box.top + to - targetY);
      scrollAt = (progress) => startScroll + delta * progress;
      scrollEnd = startScroll + delta;
    } else {
      // Collapse to just the strip on screen, invisibly, then close that while
      // the button stays where it is on screen (until the page runs out of room).
      const strip = Math.min(full, Math.max(0, box.top - headerBottom));
      const current = regionEl.getBoundingClientRect().height;
      if (current > strip) {
        regionEl.style.height = `${strip}px`;
        window.scrollBy({ top: strip - current, left: 0, behavior: "instant" });
      }
      from = strip;
      to = 0;
      const base = window.scrollY;
      scrollAt = (progress) => Math.max(0, base - strip * progress);
      scrollEnd = Math.max(0, base - strip);
    }

    const finishRun = () => {
      cancel();
      if (opening) {
        expandInPlace();
      } else {
        regionEl.style.height = "0px";
        window.scrollTo({ top: scrollEnd, left: 0, behavior: "instant" });
      }
    };

    if (duration === 0 || from === to) {
      regionEl.style.height = `${to}px`;
      window.scrollTo({ top: scrollEnd, left: 0, behavior: "instant" });
      finishRun();
      return;
    }

    regionEl.style.height = `${from}px`;

    // Any scroll input from the reader ends the motion where it stands.
    const interrupt = () => {
      cancel();
      if (opening) expandInPlace();
      else regionEl.style.height = "0px";
    };
    window.addEventListener("wheel", interrupt, { passive: true, once: true });
    window.addEventListener("touchstart", interrupt, { passive: true, once: true });
    stopListening.current = () => {
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
    };

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const p = ease(t);
      regionEl.style.height = `${from + (to - from) * p}px`;
      window.scrollTo({ top: scrollAt(p), left: 0, behavior: "instant" });
      if (t < 1) frame.current = requestAnimationFrame(step);
      else finishRun();
    };
    frame.current = requestAnimationFrame(step);
  };

  // Back/forward or a link to the other state: snap, don't animate.
  useEffect(() => {
    if (showing.current === open) return;
    showing.current = open;
    snap(open);
  }, [open, snap]);

  useEffect(() => cancel, [cancel]);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();

    const next = !isOpen;
    showing.current = next;
    run(next);
    startTransition(() => {
      setOpen(next);
      router.replace(next ? openHref : closeHref, { scroll: false });
    });
  };

  return (
    <div>
      <div
        ref={region}
        inert={!isOpen}
        className={`flex flex-col justify-end overflow-hidden ${closedAtStart ? "h-0" : ""}`}
      >
        <div ref={inner} className="shrink-0 space-y-7 pb-7">
          {children}
        </div>
      </div>

      <div ref={toggle} className="relative py-1">
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <div className="relative flex justify-center">
          <Link
            href={isOpen ? closeHref : openHref}
            scroll={false}
            onClick={onClick}
            aria-expanded={isOpen}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-semibold text-ink-muted transition hover:border-accent hover:text-accent"
          >
            <svg
              viewBox="0 0 16 16"
              className={`size-3 transition ${isOpen ? "" : "rotate-180"}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isOpen ? "Hide earlier matches" : `Show ${count} earlier ${count === 1 ? "match" : "matches"}`}
          </Link>
        </div>
      </div>
    </div>
  );
}
