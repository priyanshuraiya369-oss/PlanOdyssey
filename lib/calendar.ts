/** Dependency-free iCalendar (.ics) export and Google Calendar links. */
export type CalendarItem = { title: string; date: string; description?: string; location?: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const compact = (d: string) => d.replace(/-/g, "");
const nextDay = (d: string) => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildIcs(calendarName: string, items: CalendarItem[], now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PlanOdyssey//Event Planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(calendarName)}`];
  items.filter((i) => ISO.test(i.date)).forEach((item, index) => {
    lines.push("BEGIN:VEVENT", `UID:${compact(item.date)}-${index}@planodyssey`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${compact(item.date)}`, `DTEND;VALUE=DATE:${nextDay(item.date)}`, `SUMMARY:${esc(item.title)}`);
    if (item.description) lines.push(`DESCRIPTION:${esc(item.description)}`);
    if (item.location) lines.push(`LOCATION:${esc(item.location)}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function googleCalendarUrl(item: CalendarItem): string {
  const params = new URLSearchParams({ action: "TEMPLATE", text: item.title, dates: `${compact(item.date)}/${nextDay(item.date)}` });
  if (item.description) params.set("details", item.description);
  if (item.location) params.set("location", item.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
