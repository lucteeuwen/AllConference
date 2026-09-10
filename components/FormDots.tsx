import type { Result } from "@/lib/types";

const colors: Record<Result, string> = {
  W: "bg-win",
  L: "bg-loss",
  D: "bg-draw",
};

const labels: Record<Result, string> = { W: "Win", L: "Loss", D: "Draw" };

/** Last five results, oldest first. */
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
          className={`size-2 rounded-full ${colors[result]}`}
        >
          <span className="sr-only">{labels[result]}</span>
        </span>
      ))}
    </span>
  );
}
