import { GLOBAL_INTERVAL_MS, HOST_INTERVAL_MS, USER_AGENT } from "./config";

/**
 * Polite fetch: one request per host per second and two a second overall, a
 * descriptive User-Agent, and a couple of retries with backoff for the odd
 * 5xx or dropped connection. A site that says it is overloaded (503, 429) is
 * left alone for the rest of the run, and so is every school site once three
 * of them are: that is SIDEARM itself struggling, not one school.
 */

const lastHit = new Map<string, number>();
let lastAny = -Infinity;
/**
 * Hosts skipped for the rest of the run. One broken page is not an outage, so
 * a host is only given up on after two different URLs fail every retry.
 */
const downHosts = new Set<string>();
const failedUrls = new Map<string, Set<string>>();
let requestCount = 0;

/** "Slow down" answers: no retry, and the host is left alone this run. */
const OVERLOADED = new Set([429, 503]);
/** This many school sites down at once is SIDEARM down. */
const SIDEARM_DOWN_AT = 3;
/** The hosts we read that are not a school's SIDEARM site. */
const NOT_SIDEARM = /(^|\.)(hudl\.com|unitedsoccercoaches\.org)$/;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle(host: string): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, (lastHit.get(host) ?? -Infinity) + HOST_INTERVAL_MS, lastAny + GLOBAL_INTERVAL_MS);
  // Claim the slot before sleeping so concurrent callers queue up behind us.
  lastHit.set(host, at);
  lastAny = at;
  if (at > now) await sleep(at - now);
}

function sidearmDown(): boolean {
  return [...downHosts].filter((host) => !NOT_SIDEARM.test(host)).length >= SIDEARM_DOWN_AT;
}

export async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  const host = new URL(url).host;
  if (downHosts.has(host)) throw new Error(`${host} is down this run, skipped ${url}`);
  if (!NOT_SIDEARM.test(host) && sidearmDown()) throw new Error(`SIDEARM is down this run, skipped ${url}`);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    await throttle(host);
    requestCount++;
    let response: Response | null = null;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      lastError = error;
    }
    if (response) {
      if (OVERLOADED.has(response.status)) {
        downHosts.add(host);
        throw new Error(`${response.status} ${response.statusText} for ${url}, leaving ${host} alone this run`);
      }
      if (response.status < 500) return response;
      lastError = new Error(`${response.status} ${response.statusText} for ${url}`);
    }
    if (attempt < attempts - 1) await sleep(2 ** attempt * 1500);
  }
  const failures = failedUrls.get(host) ?? new Set<string>();
  failures.add(url);
  failedUrls.set(host, failures);
  if (failures.size >= 2) downHosts.add(host);
  throw lastError;
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return (await response.json()) as T;
}

export function requestsMade(): number {
  return requestCount;
}

export function unreachableHosts(): string[] {
  return [...downHosts];
}

/** Tests only: forget every host, slot and count. */
export function resetHttpState(): void {
  lastHit.clear();
  lastAny = -Infinity;
  downHosts.clear();
  failedUrls.clear();
  requestCount = 0;
}
