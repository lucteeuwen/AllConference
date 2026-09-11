"use client";

import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { variants, type VariantId } from "@/lib/variants";

/**
 * Temporary scaffolding for choosing a home-page design. The selection lives in
 * the URL so each one is linkable, and the whole component can be deleted once
 * a direction is picked.
 */
export function DesignSwitcher({ active }: { active: VariantId }) {
  const [open, setOpen] = useState(false);
  const current = variants.find((variant) => variant.id === active) ?? variants[0];

  return (
    <div className="fixed right-3 bottom-20 z-50 flex flex-col items-end gap-2 md:right-5 md:bottom-5">
      {open ? (
        <div className="w-60 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
          <p className="border-b border-line px-3 py-2 text-[10px] font-bold tracking-[0.12em] text-ink-faint uppercase">
            Home page design
          </p>
          {variants.map((variant, index) => (
            <Link
              key={variant.id}
              href={`/?v=${variant.id}`}
              scroll={false}
              className={`flex items-start gap-2.5 px-3 py-2.5 transition hover:bg-ground ${
                variant.id === active ? "bg-accent-soft" : ""
              }`}
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                  variant.id === active ? "bg-accent text-white" : "bg-ground text-ink-faint"
                }`}
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[13px] font-bold ${
                    variant.id === active ? "text-accent" : "text-ink"
                  }`}
                >
                  {variant.label}
                </span>
                <span className="block text-[11px] leading-snug text-ink-muted">
                  {variant.blurb}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface p-1.5 shadow-lift">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-accent-hover"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l2.4 5.2 5.6.7-4.2 3.9 1.1 5.6L12 15.7 7.1 18.4l1.1-5.6L4 8.9l5.6-.7z" strokeLinejoin="round" />
          </svg>
          {current.label}
        </button>
      </div>
    </div>
  );
}
