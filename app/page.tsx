import type { Metadata } from "next";
import { BroadcastHome } from "@/components/broadcast/BroadcastHome";
import { getHomeData } from "@/lib/home";

export const metadata: Metadata = {
  title: "CCIW Men's Soccer",
};

/**
 * Rebuilt at most every 30 seconds. The match box is timed against the clock at
 * render, and the browser re-checks that window itself between rebuilds.
 */
export const revalidate = 30;

export default async function HomePage(props: PageProps<"/">) {
  // Development only: `/?now=2026-10-03T20:20:00Z` previews the match box at
  // another moment. Production never reads the query, so the page stays cached.
  let now: number | undefined;
  if (process.env.NODE_ENV !== "production") {
    const requested = (await props.searchParams).now;
    const parsed = typeof requested === "string" ? Date.parse(requested) : NaN;
    if (!Number.isNaN(parsed)) now = parsed;
  }

  return <BroadcastHome data={await getHomeData(now)} />;
}
