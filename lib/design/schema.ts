/**
 * The single source of truth for the design sidebar.
 *
 * Every control names a CSS custom property or a data attribute on the root
 * element. Nothing else in the app knows the sidebar exists: tuning works
 * because `app/globals.css` routes every token through one of these.
 *
 * Adding a knob is one entry here.
 */

export type ControlKind = "color" | "range" | "select" | "toggle";

export type Control = {
  id: string;
  label: string;
  kind: ControlKind;
  /** A CSS custom property name, without the leading dashes. */
  cssVar?: string;
  /** A `data-*` attribute name on <html>, without the `data-` prefix. */
  dataAttr?: string;
  /** Colours differ per theme; everything else is shared. */
  perTheme?: boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  /** Shown under the label when it is not obvious what the control does. */
  hint?: string;
};

export type ControlGroup = {
  id: string;
  label: string;
  controls: Control[];
};

const color = (id: string, label: string, hint?: string): Control => ({
  id,
  label,
  kind: "color",
  cssVar: id,
  perTheme: true,
  hint,
});

const range = (
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
  unit = "",
  hint?: string,
): Control => ({ id, label, kind: "range", cssVar: id, min, max, step, unit, hint });

export const groups: ControlGroup[] = [
  {
    id: "brand",
    label: "Brand colours",
    controls: [
      color("navy", "Navy", "Page headers and hero panels"),
      color("navy-deep", "Navy deep", "Hero base beneath the colour washes"),
      color("navy-soft", "Navy soft"),
      color("brand", "Brand blue", "The logo's own blue"),
      color("accent", "Accent", "Buttons, active tabs, links"),
      color("accent-hover", "Accent hover"),
      color("accent-soft", "Accent soft", "Tinted chip backgrounds"),
    ],
  },
  {
    id: "surfaces",
    label: "Surfaces and text",
    controls: [
      color("ground", "Page background"),
      color("surface", "Card surface"),
      color("surface-raised", "Raised surface"),
      color("line", "Borders"),
      color("ink", "Text"),
      color("ink-muted", "Muted text"),
      color("ink-faint", "Faint text"),
    ],
  },
  {
    id: "status",
    label: "Status colours",
    controls: [
      color("win", "Win"),
      color("loss", "Loss"),
      color("draw", "Draw"),
      color("live", "Live"),
    ],
  },
  {
    id: "shape",
    label: "Shape and density",
    controls: [
      range("card-radius", "Card radius", 0, 32, 1, "px"),
      range("control-radius", "Control radius", 0, 999, 1, "px", "Pills, chips and buttons"),
      range("badge-radius", "Badge roundness", 0, 50, 1, "%", "50% is a circle, 0 is a square"),
      range("border-width", "Border width", 0, 3, 0.5, "px"),
      range("shadow-strength", "Shadow strength", 0, 2, 0.05),
      range("density", "Row density", 0.6, 1.8, 0.05, "", "Scales padding inside rows and cards"),
      range("section-gap", "Section gap", 0.75, 4, 0.25, "rem"),
      range("page-max", "Page width", 48, 96, 1, "rem"),
      {
        id: "cards",
        label: "Card style",
        kind: "select",
        dataAttr: "cards",
        options: [
          { value: "elevated", label: "Elevated" },
          { value: "flat", label: "Flat" },
          { value: "outlined", label: "Outlined" },
        ],
      },
    ],
  },
  {
    id: "type",
    label: "Typography",
    controls: [
      {
        id: "font-family",
        label: "Typeface",
        kind: "select",
        cssVar: "font-family",
        options: [
          { value: "var(--font-inter), ui-sans-serif, system-ui, sans-serif", label: "Inter" },
          { value: "ui-sans-serif, system-ui, sans-serif", label: "System sans" },
          {
            value: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            label: "Helvetica",
          },
          { value: "ui-serif, Georgia, Cambria, serif", label: "Serif" },
          { value: "ui-monospace, 'SF Mono', Menlo, monospace", label: "Mono" },
        ],
      },
      range("font-scale", "Text size", 0.85, 1.25, 0.01, "×"),
      {
        id: "heading-weight",
        label: "Heading weight",
        kind: "select",
        cssVar: "heading-weight",
        options: [
          { value: "600", label: "Semibold" },
          { value: "700", label: "Bold" },
          { value: "800", label: "Extrabold" },
          { value: "900", label: "Black" },
        ],
      },
      range("label-tracking", "Label tracking", 0, 0.3, 0.01, "em", "The small uppercase headings"),
      range("heading-tracking", "Heading tracking", -0.06, 0.04, 0.005, "em"),
      {
        id: "figures",
        label: "Figures",
        kind: "select",
        dataAttr: "figures",
        options: [
          { value: "tabular", label: "Tabular" },
          { value: "proportional", label: "Proportional" },
        ],
      },
    ],
  },
  {
    id: "hero",
    label: "Hero and rail",
    controls: [
      range("wash-strength", "Colour wash", 0, 1.4, 0.05, "", "How far each school's colour bleeds in"),
      range("wash-angle", "Wash angle", 60, 140, 1, "deg"),
      range("wm-opacity", "Watermark opacity", 0, 0.6, 0.01),
      range("wm-scale", "Watermark size", 0.4, 1.8, 0.05, "×"),
      range("rule-height", "Split rule", 0, 12, 1, "px"),
      range("hero-pad", "Hero padding", 0.75, 4, 0.25, "rem"),
      range("rail-tile", "Rail tile width", 140, 280, 4, "px"),
      range("team-lift", "Team colour lift", 1, 2.4, 0.05, "", "Dark mode only, for the darker schools"),
    ],
  },
  {
    id: "motion",
    label: "Motion",
    controls: [
      range("motion-scale", "Speed", 0, 2.5, 0.05, "×", "Zero stops every animation"),
      {
        id: "reveal",
        label: "Scroll reveal",
        kind: "toggle",
        dataAttr: "reveal",
        options: [
          { value: "on", label: "On" },
          { value: "off", label: "Off" },
        ],
      },
    ],
  },
  {
    id: "structure",
    label: "Structure",
    controls: [
      {
        id: "rail",
        label: "Scoreboard rail",
        kind: "toggle",
        dataAttr: "rail",
        options: [
          { value: "on", label: "Shown" },
          { value: "off", label: "Hidden" },
        ],
      },
      {
        id: "watermark",
        label: "Hero watermarks",
        kind: "toggle",
        dataAttr: "watermark",
        options: [
          { value: "on", label: "Shown" },
          { value: "off", label: "Hidden" },
        ],
      },
      {
        id: "rule",
        label: "Split rule",
        kind: "toggle",
        dataAttr: "rule",
        options: [
          { value: "on", label: "Shown" },
          { value: "off", label: "Hidden" },
        ],
      },
      {
        id: "sticky",
        label: "Sticky header",
        kind: "toggle",
        dataAttr: "sticky",
        options: [
          { value: "on", label: "Sticky" },
          { value: "off", label: "Static" },
        ],
      },
    ],
  },
];

export const allControls: Control[] = groups.flatMap((group) => group.controls);

export function findControl(id: string): Control | undefined {
  return allControls.find((control) => control.id === id);
}
