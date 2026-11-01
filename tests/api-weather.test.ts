import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/weather/route";

type Handler = (url: string) => unknown;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const request = (query: string, ip = "10.0.0.1") => new Request(`http://localhost/api/weather?${query}`, { headers: { "x-forwarded-for": ip } });
const GEO = { results: [{ name: "Jaipur", admin1: "Rajasthan", latitude: 26.9, longitude: 75.8 }] };

function mockFetch(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL) => handler(String(input)) as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T06:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/weather", () => {
  it("rejects a missing city or date with 400", async () => {
    const res = await GET(request(""));
    expect(res.status).toBe(400);
    expect((await res.json()).available).toBe(false);
  });

  it("rejects an invalid date", async () => {
    const res = await GET(request("city=Jaipur&date=tomorrow"));
    expect(res.status).toBe(400);
  });

  it("returns a live forecast when the date is within 15 days", async () => {
    const fetchMock = mockFetch((url) => url.includes("geocoding-api")
      ? json(GEO)
      : json({ daily: { weather_code: [95], temperature_2m_max: [31], temperature_2m_min: [19], precipitation_probability_max: [70], wind_speed_10m_max: [12] } }));
    const res = await GET(request("city=Jaipur,%20Rajasthan&date=2026-11-05"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ available: true, mode: "forecast", place: "Jaipur, Rajasthan", tempMax: 31, tempMin: 19, rainChance: 70, code: 95 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("searches only for the city part before the comma", async () => {
    const fetchMock = mockFetch((url) => url.includes("geocoding-api") ? json({ results: [] }) : json({}));
    await GET(request("city=Jaipur,%20Rajasthan&date=2026-11-05", "10.0.0.2"));
    expect(String(fetchMock.mock.calls[0][0])).toContain("name=Jaipur&");
  });

  it("reports a clear message when the city is unknown", async () => {
    mockFetch(() => json({ results: [] }));
    const body = await (await GET(request("city=Nowhereville&date=2026-11-05", "10.0.0.3"))).json();
    expect(body.available).toBe(false);
    expect(body.error).toContain("Could not find");
  });

  it("averages three years of history for dates beyond the forecast window", async () => {
    const days = [{ t: 30, l: 18, p: 0, w: 10 }, { t: 28, l: 16, p: 2, w: 14 }, { t: 26, l: 14, p: 5, w: 12 }];
    let call = 0;
    mockFetch((url) => {
      if (url.includes("geocoding-api")) return json(GEO);
      const d = days[call++];
      return json({ daily: { temperature_2m_max: [d.t], temperature_2m_min: [d.l], precipitation_sum: [d.p], wind_speed_10m_max: [d.w] } });
    });
    const body = await (await GET(request("city=Jaipur&date=2026-12-20", "10.0.0.4"))).json();
    expect(body).toMatchObject({ available: true, mode: "historical", years: 3, tempMax: 28, tempMin: 16, wind: 12 });
    expect(body.rainChance).toBe(67);
  });

  it("still works when one history year fails", async () => {
    let call = 0;
    mockFetch((url) => {
      if (url.includes("geocoding-api")) return json(GEO);
      return call++ === 0 ? json({ error: true }, 500) : json({ daily: { temperature_2m_max: [30], temperature_2m_min: [18], precipitation_sum: [0], wind_speed_10m_max: [9] } });
    });
    const body = await (await GET(request("city=Jaipur&date=2026-12-20", "10.0.0.5"))).json();
    expect(body.available).toBe(true);
    expect(body.years).toBe(2);
  });

  it("returns an unavailable message when every history year fails", async () => {
    mockFetch((url) => url.includes("geocoding-api") ? json(GEO) : json({ error: true }, 500));
    const body = await (await GET(request("city=Jaipur&date=2026-12-20", "10.0.0.6"))).json();
    expect(body.available).toBe(false);
    expect(body.error).toContain("No weather history");
  });

  it("returns 502 when the geocoding service is down", async () => {
    mockFetch(() => json({}, 503));
    const res = await GET(request("city=Jaipur&date=2026-12-20", "10.0.0.7"));
    expect(res.status).toBe(502);
    expect((await res.json()).available).toBe(false);
  });

  it("rate limits a client that sends too many requests", async () => {
    let last = 200;
    for (let i = 0; i < 41; i++) last = (await GET(request("", "10.9.9.9"))).status;
    expect(last).toBe(429);
  });
});
