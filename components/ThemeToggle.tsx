"use client";

/** Mirrors the boot script in app/layout.tsx. Keep the key in sync. */
const STORAGE_KEY = "cciw-theme";

type Props = {
  /** Light chrome for placement on a navy or glass panel. */
  tone?: "default" | "onDark";
  className?: string;
};

/**
 * Both icons are always rendered and CSS picks one from the `data-theme`
 * attribute, so there is no state to hydrate and no wrong-glyph flash.
 */
export function ThemeToggle({ tone = "default", className = "" }: Props) {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can throw. The theme still applies for this session.
    }
  };

  const chrome =
    tone === "onDark"
      ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
      : "border-line bg-surface text-ink-muted hover:text-accent hover:border-accent";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={`flex size-8 items-center justify-center rounded-full border transition ${chrome} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4 dark:hidden"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M20 13.5A8.5 8.5 0 0110.5 4a7 7 0 109.5 9.5z" strokeLinejoin="round" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className="hidden size-4 dark:block"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
