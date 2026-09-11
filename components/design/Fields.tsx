"use client";

import type { Control } from "@/lib/design/schema";

type FieldProps = {
  control: Control;
  value: string;
  changed: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
};

function Shell({
  control,
  changed,
  onReset,
  right,
  children,
}: FieldProps & { right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="flex min-w-0 items-baseline gap-1.5 text-[0.78rem] font-semibold text-ink">
          <span className="truncate">{control.label}</span>
          {changed ? (
            <button
              type="button"
              onClick={onReset}
              title="Reset to default"
              className="shrink-0 text-[0.65rem] font-bold text-accent hover:underline"
            >
              reset
            </button>
          ) : null}
        </label>
        {right}
      </div>
      {children}
      {control.hint ? (
        <p className="mt-1 text-[0.68rem] leading-snug text-ink-faint">{control.hint}</p>
      ) : null}
    </div>
  );
}

/** Colour inputs need a bare hex; computed values can come back as rgb(). */
function toHex(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed.slice(0, 7);
  }
  const match = trimmed.match(/rgba?\(([^)]+)\)/);
  if (!match) return "#000000";
  const [r, g, b] = match[1].split(/[,\s/]+/).map(Number);
  const hex = (n: number) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function ColorField(props: FieldProps) {
  const hex = toHex(props.value);
  return (
    <Shell {...props} right={<span className="font-mono text-[0.68rem] text-ink-faint">{hex}</span>}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(event) => props.onChange(event.target.value)}
          aria-label={props.control.label}
          className="h-8 w-12 shrink-0 cursor-pointer rounded-md border border-line bg-transparent p-0.5"
        />
        <input
          type="text"
          value={hex}
          onChange={(event) => props.onChange(event.target.value)}
          aria-label={`${props.control.label} hex`}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-[0.72rem] text-ink outline-none focus:border-accent"
        />
      </div>
    </Shell>
  );
}

export function RangeField(props: FieldProps) {
  const { control } = props;
  const numeric = parseFloat(props.value) || 0;
  return (
    <Shell
      {...props}
      right={
        <span className="shrink-0 font-mono text-[0.68rem] text-ink-faint tabular-nums">
          {numeric}
          {control.unit}
        </span>
      }
    >
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={numeric}
        onChange={(event) => props.onChange(`${event.target.value}${control.unit === "×" ? "" : control.unit ?? ""}`)}
        aria-label={control.label}
        className="w-full accent-[var(--accent)]"
      />
    </Shell>
  );
}

export function SelectField(props: FieldProps) {
  return (
    <Shell {...props}>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        aria-label={props.control.label}
        className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[0.75rem] font-semibold text-ink outline-none focus:border-accent"
      >
        {props.control.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

export function ToggleField(props: FieldProps) {
  const options = props.control.options ?? [];
  return (
    <Shell {...props}>
      <div className="flex gap-1 rounded-md bg-ground p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => props.onChange(option.value)}
            aria-pressed={props.value === option.value}
            className={`flex-1 rounded px-2 py-1 text-[0.72rem] font-bold transition ${
              props.value === option.value
                ? "bg-accent text-white"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Shell>
  );
}
