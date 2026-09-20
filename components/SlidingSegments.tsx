"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useTransition,
  type MouseEvent,
} from "react";

export type Segment<T extends string> = {
  value: T;
  label: string;
  /** Present: the segment is a link. Absent: it is a button reporting to `onChange`. */
  href?: string;
};

type Props<T extends string> = {
  label: string;
  options: Segment<T>[];
  value: T;
  /** Called with the chosen value when segments are buttons. */
  onChange?: (value: T) => void;
  /** The outline suits a control on the page; drop it inside a card. */
  ringed?: boolean;
  /** Horizontal padding of each segment. */
  itemClassName?: string;
};

/**
 * A segmented control whose blue pill slides from the old selection to the new
 * one. Segments are links when given an `href` (the page owns the state; the
 * pill starts moving on click, ahead of the server round trip, and settles on
 * whatever the page reports) and plain buttons otherwise (the parent owns it).
 *
 * The server HTML paints the active segment blue itself, so it looks right
 * before any script runs; once the sliding pill is placed it takes over that
 * background (`data-slid`) at the same spot, so nothing flashes.
 */
export function SlidingSegments<T extends string>({
  label,
  options,
  value,
  onChange,
  ringed = true,
  itemClassName = "px-3.5",
}: Props<T>) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [active, setActive] = useOptimistic(value);

  const root = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const items = useRef(new Map<string, HTMLElement>());
  const placed = useRef(false);
  // Read by `place`, so the resize observer never positions a stale selection.
  const activeRef = useRef(active);

  const place = useCallback((animate: boolean) => {
    const container = root.current;
    const indicator = pill.current;
    const link = items.current.get(activeRef.current);
    if (!container || !indicator || !link) return;

    indicator.style.transition = animate ? "" : "none";
    indicator.style.left = `${link.offsetLeft}px`;
    indicator.style.width = `${link.offsetWidth}px`;
    indicator.style.opacity = "1";
    container.dataset.slid = "true";
  }, []);

  useLayoutEffect(() => {
    activeRef.current = active;
    place(placed.current);
    placed.current = true;
  }, [active, place]);

  useLayoutEffect(() => {
    const container = root.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => place(false));
    observer.observe(container);
    return () => observer.disconnect();
  }, [place]);

  const onLinkClick = (event: MouseEvent<HTMLAnchorElement>, option: Segment<T> & { href: string }) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (option.value === active) return;
    startTransition(() => {
      setActive(option.value);
      router.push(option.href, { scroll: false });
    });
  };

  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      className={`group/seg relative flex gap-1 rounded-control bg-ground p-1 ${ringed ? "ring-1 ring-line" : ""}`}
    >
      <span
        ref={pill}
        aria-hidden="true"
        className="bc-slider absolute inset-y-1 rounded-control bg-accent shadow-sm"
        style={{ opacity: 0 }}
      />
      {options.map((option) => {
        const selected = option.value === active;
        const className = `bc-slider-text relative z-10 rounded-control ${itemClassName} py-1.5 text-[0.78rem] font-semibold ${
          selected
            ? "bg-accent text-white shadow-sm group-data-[slid=true]/seg:bg-transparent group-data-[slid=true]/seg:shadow-none"
            : "text-ink-muted hover:text-ink"
        }`;
        const remember = (el: HTMLElement | null) => {
          if (el) items.current.set(option.value, el);
          else items.current.delete(option.value);
        };

        if (option.href !== undefined) {
          const linked = { ...option, href: option.href };
          return (
            <Link
              key={option.value}
              ref={remember}
              href={option.href}
              scroll={false}
              onClick={(event) => onLinkClick(event, linked)}
              aria-current={selected ? "true" : undefined}
              className={className}
            >
              {option.label}
            </Link>
          );
        }

        return (
          <button
            key={option.value}
            ref={remember}
            type="button"
            onClick={() => onChange?.(option.value)}
            aria-pressed={selected}
            className={className}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
