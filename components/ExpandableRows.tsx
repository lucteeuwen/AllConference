"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  /** The rows kept out of sight until asked for. */
  children: ReactNode;
  moreLabel?: string;
  lessLabel?: string;
};

/**
 * Extra rows for the bottom of a card, with the button that opens them. Uses
 * the grid-rows collapse the rest of the app shares, so the rows grow open
 * rather than popping in.
 */
export function ExpandableRows({ children, moreLabel = "Show more", lessLabel = "Show less" }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <>
      <div id={id} inert={!open} className={`bc-collapse ${open ? "is-open" : ""}`}>
        <div>{children}</div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-center gap-1.5 px-4 py-3 text-[0.78rem] font-bold text-accent transition hover:bg-ground"
      >
        {open ? lessLabel : moreLabel}
        <svg
          viewBox="0 0 16 16"
          className={`bc-collapse-chevron size-3 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}
