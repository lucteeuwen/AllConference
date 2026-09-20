import type { ReactNode } from "react";

/**
 * A labelled fact on a match page. `note` is a quiet aside after the value,
 * used to say whose clock a time is on.
 */
export function DetailRow({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="bc-row flex items-baseline justify-between gap-4 border-b border-line last:border-0">
      <span className="text-[0.78rem] text-ink-muted">{label}</span>
      <span className="text-right text-[0.78rem] font-semibold text-ink">
        {value}
        {note ? <span className="ml-1.5 font-normal text-ink-faint">{note}</span> : null}
      </span>
    </div>
  );
}
