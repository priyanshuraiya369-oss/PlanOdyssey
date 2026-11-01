import { afterEach, describe, expect, it, vi } from "vitest";
import { clientKey, rateLimit } from "@/lib/rate-limit";

afterEach(() => vi.useRealTimers());

describe("rateLimit", () => {
  it("allows requests up to the limit and blocks the next one", () => {
    const key = "test:limit";
    expect([1, 2, 3].map(() => rateLimit(key, 3, 60_000))).toEqual([true, true, true]);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
  });

  it("tracks each key separately", () => {
    expect(rateLimit("test:a", 1, 60_000)).toBe(true);
    expect(rateLimit("test:a", 1, 60_000)).toBe(false);
    expect(rateLimit("test:b", 1, 60_000)).toBe(true);
  });

  it("starts a fresh window after the time passes", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    expect(rateLimit("test:window", 1, 1000)).toBe(true);
    expect(rateLimit("test:window", 1, 1000)).toBe(false);
    vi.setSystemTime(new Date("2026-11-01T00:00:02Z"));
    expect(rateLimit("test:window", 1, 1000)).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first address in x-forwarded-for", () => {
    const request = new Request("http://localhost", { headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" } });
    expect(clientKey(request)).toBe("203.0.113.5");
  });

  it("falls back to local when the header is missing", () => {
    expect(clientKey(new Request("http://localhost"))).toBe("local");
  });
});
