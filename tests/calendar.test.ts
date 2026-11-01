import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl } from "@/lib/calendar";

const NOW = new Date("2026-10-30T12:00:00Z");

describe("buildIcs", () => {
  it("builds a valid calendar wrapper with CRLF line endings", () => {
    const ics = buildIcs("Maya and Alex", [{ title: "Wedding", date: "2026-12-20" }], NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Maya and Alex");
  });

  it("creates an all-day event that ends the next day", () => {
    const ics = buildIcs("x", [{ title: "Wedding", date: "2026-12-20" }], NOW);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261220");
    expect(ics).toContain("DTEND;VALUE=DATE:20261221");
    expect(ics).toContain("DTSTAMP:20261030T120000Z");
  });

  it("rolls over month and year ends", () => {
    const ics = buildIcs("x", [{ title: "NYE", date: "2026-12-31" }], NOW);
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
  });

  it("escapes commas, semicolons and newlines", () => {
    const ics = buildIcs("a,b", [{ title: "Book venue; pay deposit", date: "2026-11-01", description: "Line one\nLine two, ok" }], NOW);
    expect(ics).toContain("X-WR-CALNAME:a\\,b");
    expect(ics).toContain("SUMMARY:Book venue\\; pay deposit");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\\, ok");
  });

  it("adds location only when given", () => {
    expect(buildIcs("x", [{ title: "a", date: "2026-11-01", location: "Jaipur" }], NOW)).toContain("LOCATION:Jaipur");
    expect(buildIcs("x", [{ title: "a", date: "2026-11-01" }], NOW)).not.toContain("LOCATION:");
  });

  it("gives every event a unique UID", () => {
    const ics = buildIcs("x", [{ title: "a", date: "2026-11-01" }, { title: "b", date: "2026-11-01" }], NOW);
    const uids = ics.split("\r\n").filter((l) => l.startsWith("UID:"));
    expect(uids).toHaveLength(2);
    expect(new Set(uids).size).toBe(2);
  });

  it("skips items whose date is not ISO", () => {
    const ics = buildIcs("x", [{ title: "bad", date: "20 Sep" }, { title: "good", date: "2026-11-01" }], NOW);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("SUMMARY:good");
  });
});

describe("googleCalendarUrl", () => {
  it("creates a template link with the event dates", () => {
    const url = googleCalendarUrl({ title: "Wedding", date: "2026-12-20", location: "Jaipur", description: "Reception" });
    expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("action")).toBe("TEMPLATE");
    expect(params.get("text")).toBe("Wedding");
    expect(params.get("dates")).toBe("20261220/20261221");
    expect(params.get("location")).toBe("Jaipur");
    expect(params.get("details")).toBe("Reception");
  });

  it("omits optional fields when not provided", () => {
    const params = new URL(googleCalendarUrl({ title: "Party", date: "2026-11-01" })).searchParams;
    expect(params.has("location")).toBe(false);
    expect(params.has("details")).toBe(false);
  });
});
