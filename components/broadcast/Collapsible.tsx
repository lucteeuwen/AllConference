"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

type Props = {
  title: string;
  /** Persisted under `cciw-${storageKey}`, mirroring cciw-theme / cciw-design. */
  storageKey: string;
  /** What it resolves to when nothing is stored yet. */
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * An open/closed section that remembers the reader's choice.
 *
 * The collapsed grid state is always the first-paint default, server and
 * client alike, whatever `defaultOpen` says — a `requestAnimationFrame` after
 * mount is the only place the persisted value gets read (the same
 * indirection-via-callback idiom `Reveal` uses, so this never trips the
 * "setState synchronously in an effect" lint rule).
 *
 * That deferral is what makes both halves of the brief work: a real collapsed
 * frame has already painted by the time the open case flips, so the CSS
 * transition plays and the section visibly grows open on load. The closed
 * case resolves to a state it was already in, so nothing changes and nothing
 * animates — no flash of content that then snaps shut.
 *
 * Trade-off: without JavaScript the section stays collapsed forever, since
 * nothing ever runs that flip. Every Reveal-wrapped section on this page
 * already makes the same trade, so this isn't a new regression.
 */
export function Collapsible({ title, storageKey, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const key = `cciw-${storageKey}`;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(key);
      } catch {
        // Private browsing can throw; fall through to defaultOpen.
      }
      setOpen(stored === "0" ? false : stored === "1" ? true : defaultOpen);
    });
    return () => cancelAnimationFrame(frame);
    // Only the very first mount should resolve a stored preference; a later
    // storageKey change is not something this component needs to handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(key, next ? "1" : "0");
    } catch {
      // Ignore: the choice just won't survive a reload this time.
    }
  };

  return (
    <div>
      <h3 className="m-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={contentId}
          className="bc-label -mx-1 mb-3 flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[0.7rem] text-ink-faint transition hover:text-ink"
        >
          <svg
            viewBox="0 0 16 16"
            className={`bc-collapse-chevron size-3 shrink-0 ${open ? "is-open" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {title}
        </button>
      </h3>

      <div id={contentId} className={`bc-collapse ${open ? "is-open" : ""}`}>
        <div>{children}</div>
      </div>
    </div>
  );
}
