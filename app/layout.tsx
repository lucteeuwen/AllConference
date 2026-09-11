import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { DesignSidebar } from "@/components/design/DesignSidebar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CCIW Men's Soccer",
    template: "%s · CCIW Men's Soccer",
  },
  description:
    "Results, fixtures, standings and rosters for College Conference of Illinois and Wisconsin men's soccer.",
};

/**
 * Applies the stored theme and any design-sidebar overrides before first
 * paint, so neither flashes its default first. It has to run synchronously in
 * the head, which rules out next/script. The storage keys match
 * components/ThemeToggle.tsx and lib/design/store.ts.
 */
const bootScript = `
(function () {
  var root = document.documentElement;
  var theme = "light";
  try {
    var stored = window.localStorage.getItem("cciw-theme");
    theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
  } catch (e) {}
  root.dataset.theme = theme;

  try {
    var raw = window.localStorage.getItem("cciw-design");
    if (raw) {
      var design = JSON.parse(raw);
      var vars = Object.assign({}, design.shared && design.shared.vars, design[theme] && design[theme].vars);
      for (var key in vars) root.style.setProperty("--" + key, vars[key]);
      var attrs = (design.shared && design.shared.attrs) || {};
      for (var attr in attrs) root.setAttribute("data-" + attr, attrs[attr]);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-ground">
        <SiteNav />
        <main
          className="mx-auto w-full flex-1 px-4 pb-24 md:px-6 md:pb-12"
          style={{ maxWidth: "var(--page-max)" }}
        >
          {children}
        </main>
        <DesignSidebar />
      </body>
    </html>
  );
}
