import { HOST_INTERVAL_MS, USER_AGENT } from "./config";

/**
 * Polite fetch: one request per host per second, a descriptive User-Agent, and
 * a couple of retries with backoff for the odd 5xx or dropped connection.
 */

const lastHit = new Map<string, number>();
/**
 * Hosts skipped for the rest of the run. One broken page is not an outage, so
 * a host is only given up on after two different URLs fail every retry.
 */
const downHosts = new Set<string>();
const failedUrls = new Map<string, Set<string>>();
let requestCount = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle(host: string): Promise<void> {
  const wait = (lastHit.get(host) ?? 0) + HOST_INTERVAL_MS - Date.now();
  // Claim the slot before sleeping so concurrent callers queue up behind us.
  lastHit.set(host, Date.now() + Math.max(wait, 0));
  if (wait > 0) await sleep(wait);
}

export async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  const host = new URL(url).host;
  if (downHosts.has(host)) throw new Error(`${host} is down this run, skipped ${url}`);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    await throttle(host);
    requestCount++;
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status < 500) return response;
      lastError = new Error(`${response.status} ${response.statusText} for ${url}`);
    } catch (error) {
      lastError = error;
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
