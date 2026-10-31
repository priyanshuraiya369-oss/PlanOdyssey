import { NextResponse } from "next/server";
import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const querySchema = z.object({ city: z.string().trim().min(2).max(120), date: z.string().date() });
const DAY = 86_400_000;

type Daily = { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[]; precipitation_sum?: number[]; wind_speed_10m_max?: number[]; weather_code?: number[] };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
  return (await response.json()) as T;
}

const average = (values: Array<number | undefined>) => {
  const nums = values.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : undefined;
};

export async function GET(request: Request) {
  if (!rateLimit(`weather:${clientKey(request)}`, 40, 60_000)) return NextResponse.json({ available: false, error: "Too many weather requests. Please wait a moment." }, { status: 429 });
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ available: false, error: "Provide a city and a valid date." }, { status: 400 });
  const { city, date } = parsed.data;

  try {
    const geo = await getJson<{ results?: Array<{ name: string; admin1?: string; latitude: number; longitude: number }> }>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.split(",")[0].trim())}&count=1&language=en&format=json`
    );
    const place = geo.results?.[0];
    if (!place) return NextResponse.json({ available: false, error: `Could not find “${city}” for a weather lookup.` });
    const label = [place.name, place.admin1].filter(Boolean).join(", ");
    const daysAway = Math.ceil((Date.parse(date) - Date.now()) / DAY);

    // 1) Real forecast when the date is within the forecast window.
    if (daysAway >= 0 && daysAway <= 15) {
      try {
        const data = await getJson<{ daily?: Daily }>(
          `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&start_date=${date}&end_date=${date}`
        );
        const d = data.daily;
        if (d?.temperature_2m_max?.length) {
          return NextResponse.json({ available: true, mode: "forecast", place: label, tempMax: d.temperature_2m_max[0], tempMin: d.temperature_2m_min?.[0], rainChance: d.precipitation_probability_max?.[0], wind: d.wind_speed_10m_max?.[0], code: d.weather_code?.[0], daysAway });
        }
      } catch (error) { console.error("[weather:forecast]", error instanceof Error ? error.message : error); }
    }

    // 2) Otherwise average the same calendar day over the last 3 years. One failed year is fine.
    const target = new Date(`${date}T00:00:00Z`);
    const settled = await Promise.allSettled([1, 2, 3].map(async (back) => {
      const d = new Date(target); d.setUTCFullYear(d.getUTCFullYear() - back);
      const day = d.toISOString().slice(0, 10);
      const data = await getJson<{ daily?: Daily }>(`https://archive-api.open-meteo.com/v1/archive?latitude=${place.latitude}&longitude=${place.longitude}&start_date=${day}&end_date=${day}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`);
      return data.daily;
    }));
    const valid = settled.flatMap((r) => (r.status === "fulfilled" && r.value?.temperature_2m_max?.length ? [r.value] : []));
    if (!valid.length) {
      settled.forEach((r) => { if (r.status === "rejected") console.error("[weather:history]", r.reason instanceof Error ? r.reason.message : r.reason); });
      return NextResponse.json({ available: false, place: label, error: "No weather history could be loaded for this date right now. Please try again shortly." });
    }
    const rainyDays = valid.filter((y) => (y.precipitation_sum?.[0] ?? 0) >= 1).length;
    return NextResponse.json({
      available: true, mode: "historical", place: label, daysAway, years: valid.length,
      tempMax: average(valid.map((y) => y.temperature_2m_max?.[0])), tempMin: average(valid.map((y) => y.temperature_2m_min?.[0])),
      rainChance: Math.round((rainyDays / valid.length) * 100), wind: average(valid.map((y) => y.wind_speed_10m_max?.[0]))
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[weather]", detail);
    return NextResponse.json({ available: false, error: "The weather service could not be reached.", detail }, { status: 502 });
  }
}