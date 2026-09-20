/**
 * Whether the visitor has an earlier page of this site to go back to. The
 * Navigation API knows exactly (it only lists same-origin entries); browsers
 * without it fall back to counting route changes since the page loaded.
 */

let routeChanges = 0;

export function noteRouteChange(): void {
  routeChanges += 1;
}

export function canGoBackInApp(): boolean {
  const navigation = (window as Window & { navigation?: { canGoBack?: boolean } }).navigation;
  if (typeof navigation?.canGoBack === "boolean") return navigation.canGoBack;
  return routeChanges > 0;
}
