import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_SPORT, isSport, SPORT_COOKIE } from "@/lib/sport";

/**
 * `/` has no page of its own: it sends a visitor to the side they used last
 * (the nav's switch remembers it), and to men's on a first visit.
 */
export function proxy(request: NextRequest) {
  const remembered = request.cookies.get(SPORT_COOKIE)?.value;
  const sport = isSport(remembered) ? remembered : DEFAULT_SPORT;
  const url = request.nextUrl.clone();
  url.pathname = `/${sport}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/",
};
