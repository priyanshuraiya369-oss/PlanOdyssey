import { afterEach, describe, expect, it, vi } from "vitest";
import { fitCategories, scheduleMilestones, todayIso } from "@/lib/schedule";

const NOW = new Date("2026-11-01T06:00:00Z");
const opts = { now: NOW, tz: "Asia/Kolkata", strict: true };

afterEach(() => vi.useRealTimers());

describe("todayIso", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(todayIso(new Date("2026-11-01T06:00:00Z"), "Asia/Kolkata")).toBe("2026-11-01");
  });

  it("respects the timezone (late UTC evening is already tomorrow in India)", () => {
    expect(todayIso(new Date("2026-10-30T20:00:00Z"), "Asia/Kolkata")).toBe("2026-10-31");
    expect(todayIso(new Date("2026-10-30T20:00:00Z"), "UTC")).toBe("2026-10-30");
  });
});

describe("scheduleMilestones", () => {
  const past = [{ date: "2026-10-11" }, { date: "2026-10-20" }, { date: "2026-11-04" }, { date: "2026-11-09" }];

  it("re-spaces past dates between today and the event", () => {
    const out = scheduleMilestones(past, "2026-11-11", opts).map((m) => m.date);
    expect(out).toEqual(["2026-11-03", "2026-11-05", "2026-11-07", "2026-11-09"]);
  });

  it("always ends two days before the event and stays in order", () => {
    const out = scheduleMilestones(past, "2026-12-20", opts).map((m) => m.date);
    expect(out[out.length - 1]).toBe("2026-12-18");
    expect([...out].sort()).toEqual(out);
    expect(out.every((d) => d > "2026-11-01")).toBe(true);
  });

  it("keeps valid ascending dates untouched (same array)", () => {
    const valid = [{ date: "2026-11-03" }, { date: "2026-11-07" }];
    expect(scheduleMilestones(valid, "2026-11-11", opts)).toBe(valid);
  });

  it("fixes out-of-order dates", () => {
    const shuffled = [{ date: "2026-11-09" }, { date: "2026-11-03" }];
    const out = scheduleMilestones(shuffled, "2026-11-11", opts).map((m) => m.date);
    expect([...out].sort()).toEqual(out);
  });

  it("fixes dates after the event", () => {
    const late = [{ date: "2026-11-20" }];
    const out = scheduleMilestones(late, "2026-11-11", opts);
    expect(out[0].date <= "2026-11-11").toBe(true);
  });

  it("treats non-ISO text as bad in strict mode", () => {
    const out = scheduleMilestones([{ date: "next week" }], "2026-11-11", opts);
    expect(out[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("leaves non-ISO labels alone when not strict", () => {
    const labels = [{ date: "20 Sep" }];
    expect(scheduleMilestones(labels, "2026-11-11", { now: NOW, strict: false })).toBe(labels);
  });

  it("does nothing when the event is today or in the past", () => {
    expect(scheduleMilestones(past, "2026-11-01", opts)).toBe(past);
    expect(scheduleMilestones(past, "2026-10-01", opts)).toBe(past);
  });

  it("does nothing for an empty list or an invalid event date", () => {
    expect(scheduleMilestones([], "2026-11-11", opts)).toEqual([]);
    expect(scheduleMilestones(past, "not-a-date", opts)).toBe(past);
  });

  it("keeps the other fields of each milestone", () => {
    const out = scheduleMilestones([{ date: "2026-10-01", title: "Book venue" }], "2026-11-11", opts);
    expect(out[0].title).toBe("Book venue");
  });
});

describe("fitCategories", () => {
  const cats = [{ label: "Food", amount: 13000 }, { label: "Cake", amount: 12000 }, { label: "Decor", amount: 1800 }];

  it("scales proportionally so the total never exceeds the budget", () => {
    const out = fitCategories(cats, 16000);
    const total = out.reduce((s, c) => s + c.amount, 0);
    expect(total).toBeLessThanOrEqual(16000);
    expect(total).toBeGreaterThan(15990);
    expect(out[0].amount).toBeGreaterThan(out[1].amount);
  });

  it("keeps labels and other fields", () => {
    expect(fitCategories(cats, 16000).map((c) => c.label)).toEqual(["Food", "Cake", "Decor"]);
  });

  it("returns the same array when already within budget", () => {
    expect(fitCategories(cats, 50000)).toBe(cats);
  });

  it("returns the same array for an invalid budget or empty list", () => {
    expect(fitCategories(cats, 0)).toBe(cats);
    expect(fitCategories(cats, Number.NaN)).toBe(cats);
    expect(fitCategories([], 1000)).toEqual([]);
  });
});
