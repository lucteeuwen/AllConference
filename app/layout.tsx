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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-ground">
        <SiteNav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 md:px-6 md:pb-12">
          {children}
        </main>
      </body>
    </html>
  );
}
