import type { Metadata } from "next";
import { BroadcastHome } from "@/components/broadcast/BroadcastHome";
import { getHomeData } from "@/lib/home";

export const metadata: Metadata = {
  title: "CCIW Men's Soccer",
};

/** The fixture data is generated relative to today, so this cannot be frozen. */
export const dynamic = "force-dynamic";

export default function HomePage() {
  return <BroadcastHome data={getHomeData()} />;
}
