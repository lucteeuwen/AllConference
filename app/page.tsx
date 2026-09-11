import type { Metadata } from "next";
import { DesignSwitcher } from "@/components/DesignSwitcher";
import { BroadcastHome } from "@/components/home/BroadcastHome";
import { BroadsheetHome } from "@/components/home/BroadsheetHome";
import { GlassHome } from "@/components/home/GlassHome";
import { KineticHome } from "@/components/home/KineticHome";
import { TicketHome } from "@/components/home/TicketHome";
import { getHomeData } from "@/lib/home";
import { parseVariant, type VariantId } from "@/lib/variants";
import type { HomeData } from "@/lib/home";

export const metadata: Metadata = {
  title: "CCIW Men's Soccer",
};

/** The fixture data is generated relative to today, so this cannot be frozen. */
export const dynamic = "force-dynamic";

const designs: Record<VariantId, (props: { data: HomeData }) => React.ReactNode> = {
  broadcast: BroadcastHome,
  glass: GlassHome,
  ticket: TicketHome,
  broadsheet: BroadsheetHome,
  kinetic: KineticHome,
};

export default async function HomePage(props: PageProps<"/">) {
  const variant = parseVariant((await props.searchParams).v);
  const Design = designs[variant];

  return (
    <>
      <Design data={getHomeData()} />
      <DesignSwitcher active={variant} />
    </>
  );
}
