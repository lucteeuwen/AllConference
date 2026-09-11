import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
 * Applies the stored theme before first paint, so a dark-mode reader never sees
 * a white flash. Must run synchronously in the head, which rules out
 * next/script. The storage key matches components/ThemeToggle.tsx.
 */
const themeBootScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("cciw-theme");
    var theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-ground">
        <SiteNav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 md:px-6 md:pb-12">
          {children}
        </main>
      </body>
    </html>
  );
}
