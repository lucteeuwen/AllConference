import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { InstallPrompt } from "@/components/InstallPrompt";
import { RouteTracker } from "@/components/RouteTracker";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

/* Barlow for reading, Barlow Condensed in heavy italic caps for display type. */
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  // Each sport's layout (app/[sport]/layout.tsx) names its own.
  title: {
    default: "CCIW Soccer",
    template: "%s · CCIW Soccer",
  },
  description:
    "Results, fixtures, standings and rosters for College Conference of Illinois and Wisconsin men's and women's soccer.",
  // Lets iOS launch the home-screen icon full screen. Other platforms read the manifest.
  appleWebApp: {
    capable: true,
    title: "CCIW Soccer",
    // Solid bar with the page below it. "black-translucent" would put white status text on the light theme.
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  // The navy matches the desktop header band and the manifest's theme colour.
  themeColor: "#013369",
  // Lets the page draw under the notch so env(safe-area-inset-*) is populated.
  viewportFit: "cover",
};

/**
 * Applies the stored theme before first paint, so it doesn't flash its
 * default first. It has to run synchronously in the head, which rules out
 * next/script. The storage key matches lib/theme.ts.
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
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-ground">
        <RouteTracker />
        <SiteNav />
        <InstallPrompt />
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
