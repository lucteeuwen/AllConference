/** Mirrors the boot script in app/layout.tsx. Keep the key in sync. */
const STORAGE_KEY = "cciw-theme";

export type Theme = "light" | "dark";

/** The theme on the page now, as the boot script or the last choice set it. */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing can throw. The theme still applies for this session.
  }
}
