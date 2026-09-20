"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { noteRouteChange } from "@/lib/navigation";

/** Mounted once in the layout so `canGoBackInApp` can tell an in-app visit from a direct one. */
export function RouteTracker() {
  const pathname = usePathname();
  const last = useRef(pathname);

  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    noteRouteChange();
  }, [pathname]);

  return null;
}
