import { cache } from "react";

/**
 * The server's clock at this render, read once per request so every component
 * that needs it agrees. Components receive it as a value rather than reaching
 * for the clock themselves, which is what lets the browser's first paint match
 * the HTML: see `lib/use-now.ts`.
 */
export const renderedAt = cache(() => Date.now());
