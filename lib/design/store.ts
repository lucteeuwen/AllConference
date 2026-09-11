import { allControls, type Control } from "@/lib/design/schema";

/**
 * Reads, applies and serialises design overrides.
 *
 * Colours are stored per theme so light and dark stay independent; everything
 * else is shared. The persisted shape is deliberately schema-free so the boot
 * script in `app/layout.tsx` can replay it before first paint without pulling
 * this module into the document head.
 */

export const STORAGE_KEY = "cciw-design";

export type Theme = "light" | "dark";

export type Overrides = {
  shared: { vars: Record<string, string>; attrs: Record<string, string> };
  light: { vars: Record<string, string> };
  dark: { vars: Record<string, string> };
};

export function emptyOverrides(): Overrides {
  return { shared: { vars: {}, attrs: {} }, light: { vars: {} }, dark: { vars: {} } };
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function load(): Overrides {
  const base = emptyOverrides();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Overrides>;
    return {
      shared: {
        vars: { ...base.shared.vars, ...parsed.shared?.vars },
        attrs: { ...base.shared.attrs, ...parsed.shared?.attrs },
      },
      light: { vars: { ...parsed.light?.vars } },
      dark: { vars: { ...parsed.dark?.vars } },
    };
  } catch {
    return base;
  }
}

export function save(overrides: Overrides): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Private browsing can throw. Tuning still applies for this session.
  }
}

/* ------------------------------------------------------------------------ */
/* Defaults                                                                  */
/* ------------------------------------------------------------------------ */

const defaultCache: Partial<Record<Theme, Record<string, string>>> = {};

/**
 * The stylesheet's own values, read by stripping the inline overrides, taking
 * a computed reading, then putting them back. Cached per theme because the
 * palettes differ.
 */
export function defaultsFor(theme: Theme): Record<string, string> {
  const cached = defaultCache[theme];
  if (cached) return cached;

  const root = document.documentElement;
  const vars = allControls.filter((control) => control.cssVar);

  const stashed: Record<string, string> = {};
  for (const control of vars) {
    const name = `--${control.cssVar}`;
    const inline = root.style.getPropertyValue(name);
    if (inline) {
      stashed[name] = inline;
      root.style.removeProperty(name);
    }
  }

  const computed = getComputedStyle(root);
  const result: Record<string, string> = {};
  for (const control of vars) {
    result[control.id] = computed.getPropertyValue(`--${control.cssVar}`).trim();
  }

  for (const [name, value] of Object.entries(stashed)) {
    root.style.setProperty(name, value);
  }

  defaultCache[theme] = result;
  return result;
}

/** Attribute controls default to their first option. */
export function defaultAttr(control: Control): string {
  return control.options?.[0]?.value ?? "";
}

/* ------------------------------------------------------------------------ */
/* Applying                                                                  */
/* ------------------------------------------------------------------------ */

export function apply(overrides: Overrides, theme: Theme): void {
  const root = document.documentElement;

  // Clear first: switching theme must not leave the other theme's colours on.
  for (const control of allControls) {
    if (control.cssVar) root.style.removeProperty(`--${control.cssVar}`);
  }

  for (const [id, value] of Object.entries(overrides.shared.vars)) {
    const control = allControls.find((entry) => entry.id === id);
    if (control?.cssVar) root.style.setProperty(`--${control.cssVar}`, value);
  }
  for (const [id, value] of Object.entries(overrides[theme].vars)) {
    const control = allControls.find((entry) => entry.id === id);
    if (control?.cssVar) root.style.setProperty(`--${control.cssVar}`, value);
  }

  for (const control of allControls) {
    if (!control.dataAttr) continue;
    const value = overrides.shared.attrs[control.id];
    if (value) root.dataset[control.dataAttr] = value;
    else delete root.dataset[control.dataAttr];
  }
}

/** The value a control is currently showing, override or stylesheet default. */
export function valueOf(control: Control, overrides: Overrides, theme: Theme): string {
  if (control.dataAttr) {
    return overrides.shared.attrs[control.id] ?? defaultAttr(control);
  }
  const scope = control.perTheme ? overrides[theme].vars : overrides.shared.vars;
  return scope[control.id] ?? defaultsFor(theme)[control.id] ?? "";
}

export function setValue(
  overrides: Overrides,
  control: Control,
  value: string,
  theme: Theme,
): Overrides {
  const next: Overrides = {
    shared: { vars: { ...overrides.shared.vars }, attrs: { ...overrides.shared.attrs } },
    light: { vars: { ...overrides.light.vars } },
    dark: { vars: { ...overrides.dark.vars } },
  };

  if (control.dataAttr) next.shared.attrs[control.id] = value;
  else if (control.perTheme) next[theme].vars[control.id] = value;
  else next.shared.vars[control.id] = value;

  return next;
}

export function clearValue(overrides: Overrides, control: Control, theme: Theme): Overrides {
  const next: Overrides = {
    shared: { vars: { ...overrides.shared.vars }, attrs: { ...overrides.shared.attrs } },
    light: { vars: { ...overrides.light.vars } },
    dark: { vars: { ...overrides.dark.vars } },
  };

  if (control.dataAttr) delete next.shared.attrs[control.id];
  else if (control.perTheme) delete next[theme].vars[control.id];
  else delete next.shared.vars[control.id];

  return next;
}

export function changeCount(overrides: Overrides): number {
  return (
    Object.keys(overrides.shared.vars).length +
    Object.keys(overrides.shared.attrs).length +
    Object.keys(overrides.light.vars).length +
    Object.keys(overrides.dark.vars).length
  );
}

/* ------------------------------------------------------------------------ */
/* Export                                                                    */
/* ------------------------------------------------------------------------ */

function block(selector: string, vars: Record<string, string>): string {
  const entries = Object.entries(vars);
  if (entries.length === 0) return "";
  const body = entries
    .map(([id, value]) => {
      const control = allControls.find((entry) => entry.id === id);
      return `  --${control?.cssVar ?? id}: ${value};`;
    })
    .sort()
    .join("\n");
  return `${selector} {\n${body}\n}\n`;
}

/** A paste-ready CSS block of only what was changed. */
export function toCss(overrides: Overrides): string {
  const parts = [
    block(":root", { ...overrides.shared.vars, ...overrides.light.vars }),
    block(':root[data-theme="dark"]', overrides.dark.vars),
  ].filter(Boolean);

  const attrs = Object.entries(overrides.shared.attrs);
  if (attrs.length > 0) {
    const list = attrs.map(([id, value]) => {
      const control = allControls.find((entry) => entry.id === id);
      return `data-${control?.dataAttr ?? id}="${value}"`;
    });
    parts.push(`/* on <html>: ${list.join(" ")} */\n`);
  }

  return parts.join("\n").trim() || "/* nothing changed yet */";
}

/* ------------------------------------------------------------------------ */
/* Subscription                                                              */
/*                                                                            */
/* The panel's state lives in localStorage and in an attribute on <html>,     */
/* both of which are outside React. useSyncExternalStore is the supported way */
/* to read them without a hydration mismatch or a setState-in-effect.         */
/* ------------------------------------------------------------------------ */

const PANEL_KEY = "cciw-design-open";

export type SidebarState = {
  overrides: Overrides;
  open: boolean;
  theme: Theme;
};

const serverSnapshot: SidebarState = {
  overrides: emptyOverrides(),
  open: false,
  theme: "light",
};

let snapshot: SidebarState | null = null;
let listeners: (() => void)[] = [];

function loadOpen(): boolean {
  try {
    return window.localStorage.getItem(PANEL_KEY) === "1";
  } catch {
    return false;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function getSnapshot(): SidebarState {
  if (!snapshot) {
    const open = loadOpen();
    if (open) document.documentElement.dataset.design = "open";
    snapshot = { overrides: load(), open, theme: currentTheme() };
  }
  return snapshot;
}

export function getServerSnapshot(): SidebarState {
  return serverSnapshot;
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener);

  // The theme toggle writes the attribute directly, so watch for it and hand
  // React a fresh snapshot carrying that theme's overrides.
  const observer = new MutationObserver(() => {
    const theme = currentTheme();
    if (snapshot && snapshot.theme !== theme) {
      snapshot = { ...snapshot, theme };
      apply(snapshot.overrides, theme);
      emit();
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
    observer.disconnect();
  };
}

export function setOverrides(next: Overrides): void {
  const theme = snapshot?.theme ?? currentTheme();
  snapshot = { overrides: next, open: snapshot?.open ?? false, theme };
  apply(next, theme);
  save(next);
  emit();
}

export function setOpen(open: boolean): void {
  // Drives the page shift in globals.css.
  if (open) document.documentElement.dataset.design = "open";
  else delete document.documentElement.dataset.design;

  snapshot = {
    overrides: snapshot?.overrides ?? emptyOverrides(),
    open,
    theme: snapshot?.theme ?? currentTheme(),
  };
  try {
    window.localStorage.setItem(PANEL_KEY, open ? "1" : "0");
  } catch {
    // Ignore: the panel just forgets its state next reload.
  }
  emit();
}
