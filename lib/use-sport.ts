"use client";

import { useParams } from "next/navigation";
import { parseSport, type Sport } from "@/lib/sport";

/** The sport of the page being shown, from its `/men` or `/women` prefix. */
export function useSport(): Sport {
  return parseSport(useParams<{ sport?: string }>()?.sport);
}
