import type { Metadata } from "next";
import { MatchesView } from "@/components/matches/MatchesView";
import { parseFilters } from "@/lib/filters";
import { renderedAt } from "@/lib/rendered-at";
import { getSeasonData } from "@/lib/season-data";
import { slimForList } from "@/lib/selectors";

export const metadata: Metadata = {
  title: "Matches",
};

/**
 * Everything below the title is rendered by `MatchesView`, in the browser's own
 * time zone: which calendar day a kickoff belongs to depends on where it is
 * read, so the grouping cannot be settled here. This page only reads the
 * season and hands it over.
 */
export default async function MatchesPage(props: PageProps<"/matches">) {
  const filters = parseFilters(await props.searchParams);
  const data = await getSeasonData();

  return (
    <MatchesView
      matches={data.matches.map(slimForList)}
      filters={filters}
      conference={data.conference}
      renderedAt={renderedAt()}
    />
  );
}
