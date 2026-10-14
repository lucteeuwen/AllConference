import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GLOBAL_INTERVAL_MS } from "../config";
import { fetchText, requestsMade, resetHttpState, unreachableHosts } from "../http";

type Reply = number | Error;

/** A fetch that answers each host from its own queue of replies (the last one repeats). */
function stubFetch(replies: Record<string, Reply[]>) {
  const calls: { host: string; at: number }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const host = new URL(url).host;
      calls.push({ host, at: Date.now() });
      const queue = replies[host] ?? [200];
      const reply = queue.length > 1 ? queue.shift()! : queue[0];
      if (reply instanceof Error) throw reply;
      return new Response("ok", { status: reply, statusText: reply === 200 ? "OK" : "Error" });
    }),
  );
  return calls;
}

describe("polite fetch", () => {
  beforeEach(() => {
    resetHttpState();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Runs a request while letting the throttle's and backoff's timers fire. */
  async function settle<T>(promise: Promise<T>): Promise<T> {
    const result = promise.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await vi.runAllTimersAsync();
    const outcome = await result;
    if ("error" in outcome) throw outcome.error;
    return outcome.value;
  }

  it("spaces requests to different hosts by the global interval", async () => {
    const calls = stubFetch({});
    await settle(Promise.all(["a.example", "b.example", "c.example"].map((host) => fetchText(`https://${host}/`))));
    const gaps = calls.slice(1).map((call, index) => call.at - calls[index].at);
    expect(gaps.every((gap) => gap >= GLOBAL_INTERVAL_MS)).toBe(true);
  });

  it("leaves a host alone after one 503, without retrying", async () => {
    const calls = stubFetch({ "school.example": [503] });
    await expect(settle(fetchText("https://school.example/feed"))).rejects.toThrow(/503/);
    expect(calls).toHaveLength(1);
    expect(unreachableHosts()).toEqual(["school.example"]);
    await expect(settle(fetchText("https://school.example/other"))).rejects.toThrow(/down this run/);
    expect(calls).toHaveLength(1);
  });

  it("still retries a dropped connection", async () => {
    const calls = stubFetch({ "school.example": [new Error("socket hang up"), 200] });
    await expect(settle(fetchText("https://school.example/feed"))).resolves.toBe("ok");
    expect(calls).toHaveLength(2);
  });

  it("stops asking any school site once three are overloaded, but not Hudl", async () => {
    stubFetch({ "a.example": [503], "b.example": [503], "c.example": [429] });
    for (const host of ["a.example", "b.example", "c.example"]) {
      await expect(settle(fetchText(`https://${host}/`))).rejects.toThrow();
    }
    const before = requestsMade();
    await expect(settle(fetchText("https://d.example/"))).rejects.toThrow(/SIDEARM is down/);
    expect(requestsMade()).toBe(before);
    await expect(settle(fetchText("https://vcloud.hudl.com/api/viewer/broadcast"))).resolves.toBe("ok");
  });
});
