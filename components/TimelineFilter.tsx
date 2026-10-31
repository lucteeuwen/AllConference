"use client";

import { useState, type ReactNode } from "react";
import { SlidingSegments } from "@/components/SlidingSegments";

type Filter = "all" | "key";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All plays" },
  { value: "key", label: "Goals & cards" },
];

/**
 * The timeline's All plays / Goals & cards switch. The list itself is rendered
 * on the server; every minor play in it carries `data-minor`, which the
 * "Goals & cards" view hides, so the choice costs no round trip.
 */
export function TimelineFilter({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<Filter>("all");

  return (
    <div data-filter={filter} className="[&[data-filter=key]_[data-minor]]:hidden">
      <div className="mb-3">
        <SlidingSegments
          label="Timeline plays"
          value={filter}
          onChange={setFilter}
          options={filters}
          ringed={false}
          itemClassName="px-3"
        />
      </div>
      {children}
    </div>
  );
}
