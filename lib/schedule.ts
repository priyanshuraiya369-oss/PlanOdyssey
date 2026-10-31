/** Milestone scheduling helpers shared by the server (/api/plans) and the UI. */
const DAY = 86_400_000;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Today's calendar date as YYYY-MM-DD. Pass a timezone (e.g. "Asia/Kolkata") on the server. */
export function todayIso(now: Date = new Date(), timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", timeZone ? { timeZone } : undefined).format(now);
}

type Options = { now?: Date; tz?: string; strict?: boolean };

/**
 * Keeps milestone dates between today and the event. If any date is invalid, out of order,
 * already past, or after the event, all milestones are re-spaced evenly and the last one lands
 * two days before the event. With strict=false, non-ISO labels (e.g. "20 Sep") are left alone.
 */
export function scheduleMilestones<T extends { date: string }>(items: T[], eventDate: string, options: Options = {}): T[] {
  const start = Date.parse(todayIso(options.now ?? new Date(), options.tz));
  const event = Date.parse(eventDate);
  if (!items.length || Number.isNaN(event) || event <= start) return items;
  if (!options.strict && !items.every((m) => ISO_DATE.test(m.date))) return items;
  const times = items.map((m) => (ISO_DATE.test(m.date) ? Date.parse(m.date) : NaN));
  const ordered = times.every((t, i) => !Number.isNaN(t) && t >= start && t <= event && (i === 0 || t >= times[i - 1]));
  if (ordered) return items;
  const days = Math.round((event - start) / DAY);
  const span = Math.max(days - 2, 1);
  return items.map((m, i) => ({ ...m, date: iso(start + Math.min(days, Math.max(0, Math.round((span * (i + 1)) / items.length))) * DAY) }));
}
