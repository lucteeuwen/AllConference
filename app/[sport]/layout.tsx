import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSport, SPORT_LABEL, SPORTS } from "@/lib/sport";

/** `/men` and `/women`: everything below is one sport's season. */
export function generateStaticParams() {
  return SPORTS.map((sport) => ({ sport }));
}

export async function generateMetadata(props: LayoutProps<"/[sport]">): Promise<Metadata> {
  const { sport } = await props.params;
  if (!isSport(sport)) return {};
  const name = `CCIW ${SPORT_LABEL[sport]}`;
  return {
    title: { default: name, template: `%s · ${name}` },
    description: `Results, fixtures, standings and rosters for College Conference of Illinois and Wisconsin ${sport === "men" ? "men's" : "women's"} soccer.`,
  };
}

/**
 * Not `dynamicParams = false`: that would carry down to the match, team and
 * player pages, whose ids are never listed ahead of time.
 */
export default async function SportLayout(props: LayoutProps<"/[sport]">) {
  if (!isSport((await props.params).sport)) notFound();
  return props.children;
}
