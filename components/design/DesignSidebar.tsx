"use client";

import { useState, useSyncExternalStore } from "react";
import { ColorField, RangeField, SelectField, ToggleField } from "@/components/design/Fields";
import { ThemeToggle } from "@/components/ThemeToggle";
import { groups, type Control } from "@/lib/design/schema";
import {
  changeCount,
  clearValue,
  emptyOverrides,
  getServerSnapshot,
  getSnapshot,
  setOpen,
  setOverrides,
  setValue,
  subscribe,
  toCss,
  valueOf,
} from "@/lib/design/store";

/**
 * Live design controls. Every change writes a CSS custom property or a data
 * attribute on the root element, so the whole app restyles immediately with no
 * rebuild and no state threaded through components.
 *
 * This is a tuning tool, not product. It lives entirely in components/design
 * and lib/design plus one mount in the layout.
 */
export function DesignSidebar() {
  // Panel state lives in localStorage and in an attribute on <html>, both
  // outside React. Reading them through a store subscription keeps the server
  // and client markup in agreement.
  const { overrides, open, theme } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const [openGroup, setOpenGroup] = useState<string | null>("brand");
  const [copied, setCopied] = useState(false);

  const toggleOpen = () => setOpen(!open);
  const update = (control: Control, value: string) =>
    setOverrides(setValue(overrides, control, value, theme));
  const reset = (control: Control) => setOverrides(clearValue(overrides, control, theme));

  const changes = changeCount(overrides);

  const copyCss = async () => {
    try {
      await navigator.clipboard.writeText(toCss(overrides));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the textarea below is still selectable.
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggleOpen}
        className="bc-shadow-lift fixed right-3 bottom-20 z-50 flex items-center gap-2 rounded-control border border-line bg-surface px-3.5 py-2 text-[0.75rem] font-bold text-ink transition hover:border-accent md:right-5 md:bottom-5"
      >
        <Sliders />
        Design
        {changes > 0 ? (
          <span className="rounded-full bg-accent px-1.5 text-[0.65rem] font-black text-white tabular-nums">
            {changes}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-[-12px_0_40px_-20px_rgba(0,0,0,0.45)] sm:w-[19rem]">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <Sliders />
        <span className="flex-1 text-[0.82rem] font-black text-ink">Design</span>
        <ThemeToggle />
        <button
          type="button"
          onClick={toggleOpen}
          aria-label="Close design panel"
          className="flex size-8 items-center justify-center rounded-full border border-line text-ink-muted transition hover:text-accent"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <p className="border-b border-line px-3 py-2 text-[0.68rem] text-ink-faint">
        Editing <span className="font-bold text-ink-muted">{theme}</span> mode. Colours are saved
        per mode; everything else is shared.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map((group) => {
          const expanded = openGroup === group.id;
          const groupChanges = group.controls.filter(
            (control) => valueOf(control, overrides, theme) !== valueOf(control, emptyOverrides(), theme),
          ).length;

          return (
            <section key={group.id} className="border-b border-line">
              <button
                type="button"
                onClick={() => setOpenGroup(expanded ? null : group.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-ground"
              >
                <span className="bc-label flex-1 text-[0.68rem] text-ink">{group.label}</span>
                {groupChanges > 0 ? (
                  <span className="rounded-full bg-accent-soft px-1.5 text-[0.62rem] font-black text-accent tabular-nums">
                    {groupChanges}
                  </span>
                ) : null}
                <svg
                  viewBox="0 0 16 16"
                  className={`size-3 text-ink-faint transition ${expanded ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {expanded ? (
                <div className="divide-y divide-line/60 border-t border-line/60">
                  {group.controls.map((control) => {
                    const value = valueOf(control, overrides, theme);
                    const changed =
                      control.dataAttr !== undefined
                        ? overrides.shared.attrs[control.id] !== undefined
                        : control.perTheme
                          ? overrides[theme].vars[control.id] !== undefined
                          : overrides.shared.vars[control.id] !== undefined;

                    const props = {
                      control,
                      value,
                      changed,
                      onChange: (next: string) => update(control, next),
                      onReset: () => reset(control),
                    };

                    if (control.kind === "color") return <ColorField key={control.id} {...props} />;
                    if (control.kind === "range") return <RangeField key={control.id} {...props} />;
                    if (control.kind === "toggle") return <ToggleField key={control.id} {...props} />;
                    return <SelectField key={control.id} {...props} />;
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <footer className="border-t border-line p-3">
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={copyCss}
            className="flex-1 rounded-md bg-accent px-3 py-2 text-[0.75rem] font-bold text-white transition hover:bg-accent-hover"
          >
            {copied ? "Copied" : "Copy CSS"}
          </button>
          <button
            type="button"
            onClick={() => setOverrides(emptyOverrides())}
            disabled={changes === 0}
            className="rounded-md border border-line px-3 py-2 text-[0.75rem] font-bold text-ink-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
          >
            Reset all
          </button>
        </div>
        <textarea
          readOnly
          value={toCss(overrides)}
          spellCheck={false}
          onFocus={(event) => event.currentTarget.select()}
          className="h-24 w-full resize-none rounded-md border border-line bg-ground p-2 font-mono text-[0.62rem] leading-relaxed text-ink-muted outline-none"
        />
        <p className="mt-1.5 text-[0.62rem] leading-snug text-ink-faint">
          {changes} change{changes === 1 ? "" : "s"}. Paste this into app/globals.css to make it
          permanent, or send it back to have it applied.
        </p>
      </footer>
    </aside>
  );
}

function Sliders() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="17" r="2" />
    </svg>
  );
}
