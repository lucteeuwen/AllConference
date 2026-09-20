import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RouteTracker } from "@/components/RouteTracker";
import { SiteNav } from "@/components/SiteNav";
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
 * Applies the stored theme before first paint, so it doesn't flash its
 * default first. It has to run synchronously in the head, which rules out
 * next/script. The storage key matches components/ThemeToggle.tsx.
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
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-ground">
        <RouteTracker />
        <SiteNav />
        <main
          className="mx-auto w-full flex-1 px-4 pb-24 md:px-6 md:pb-12"
          style={{ maxWidth: "var(--page-max)" }}
        >
          {children}
        </main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
