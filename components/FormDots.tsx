import type { Result } from "@/lib/types";

const colors: Record<Result, string> = {
  W: "bg-win",
  L: "bg-loss",
  D: "bg-draw",
};

const labels: Record<Result, string> = { W: "Win", L: "Loss", D: "Draw" };

/**
 * Last five results, oldest first. Each dot is `relative` so its screen-reader
 * text (absolutely positioned) stays with the dot; otherwise it anchors to the
 * page and widens it when the dots sit in a horizontally scrolling table.
 */
export function FormDots({ form }: { form: Result[] }) {
  if (form.length === 0) {
    return <span className="text-xs text-ink-faint">&mdash;</span>;
  }

  return (
    <span className="flex items-center gap-1">
      {form.map((result, index) => (
        <span
          key={index}
          title={labels[result]}
          className={`relative size-2 rounded-full ${colors[result]}`}
        >
          <span className="sr-only">{labels[result]}</span>
        </span>
      ))}
    </span>
  );
}
