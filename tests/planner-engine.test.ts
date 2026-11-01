import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPlanMilestones, formatCurrency, getBudgetAnalytics, getBudgetHealth, INITIAL_STATE, recalculateState } from "@/lib/planner-engine";

afterEach(() => vi.useRealTimers());

describe("formatCurrency", () => {
  it("formats rupees without decimals", () => {
    expect(formatCurrency(16000)).toBe("₹16,000");
  });

  it("uses Indian digit grouping", () => {
    expect(formatCurrency(1500000, "INR")).toBe("₹15,00,000");
  });

  it("formats dollars", () => {
    expect(formatCurrency(1200, "USD")).toBe("$1,200");
  });

  it("shows zero for invalid numbers", () => {
    expect(formatCurrency(Number.NaN)).toBe("₹0");
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe("₹0");
  });
});

describe("INITIAL_STATE", () => {
  it("has allocations that fit inside the budget", () => {
    const allocated = INITIAL_STATE.categories.reduce((sum, c) => sum + c.amount, 0);
    expect(allocated).toBeLessThanOrEqual(INITIAL_STATE.budget);
  });

  it("starts with milestones and vendors", () => {
    expect(INITIAL_STATE.milestones).toHaveLength(4);
    expect(INITIAL_STATE.vendors.length).toBeGreaterThan(0);
  });
});

describe("getBudgetHealth", () => {
  it("reports remaining budget and percentage used", () => {
    const health = getBudgetHealth(INITIAL_STATE);
    expect(health.remaining).toBe(2750);
    expect(health.percent).toBe(83);
    expect(health.over).toBe(false);
  });

  it("flags an over-budget plan", () => {
    const health = getBudgetHealth({ ...INITIAL_STATE, budget: 10000 });
    expect(health.remaining).toBe(-3250);
    expect(health.over).toBe(true);
  });

  it("handles a zero budget without dividing by zero", () => {
    expect(getBudgetHealth({ ...INITIAL_STATE, budget: 0 }).percent).toBe(0);
  });
});

describe("getBudgetAnalytics", () => {
  it("calculates allocation, utilisation and cost per guest", () => {
    const a = getBudgetAnalytics(INITIAL_STATE);
    expect(a.allocated).toBe(13250);
    expect(a.remaining).toBe(2750);
    expect(a.utilization).toBeCloseTo(82.81, 1);
    expect(a.costPerGuest).toBeCloseTo(110.42, 1);
    expect(a.status).toBe("under");
  });

  it("has category percentages that add up to 100", () => {
    const total = getBudgetAnalytics(INITIAL_STATE).categoryBreakdown.reduce((s, c) => s + c.percentage, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("detects balanced, over and invalid budgets", () => {
    expect(getBudgetAnalytics({ ...INITIAL_STATE, budget: 13250 }).status).toBe("balanced");
    expect(getBudgetAnalytics({ ...INITIAL_STATE, budget: 10000 }).status).toBe("over");
    expect(getBudgetAnalytics({ ...INITIAL_STATE, budget: 0 }).status).toBe("invalid");
  });

  it("returns null cost per guest when there are no guests", () => {
    expect(getBudgetAnalytics({ ...INITIAL_STATE, guests: 0 }).costPerGuest).toBeNull();
  });

  it("compares against a previous plan", () => {
    const previous = { ...INITIAL_STATE, categories: INITIAL_STATE.categories.map((c) => c.id === "venue" ? { ...c, amount: c.amount - 1000 } : c) };
    expect(getBudgetAnalytics(INITIAL_STATE, previous).change).toBe(1000);
    expect(getBudgetAnalytics(INITIAL_STATE).change).toBeNull();
  });
});

describe("recalculateState", () => {
  it("scales guest-driven categories up when guests grow", () => {
    const next = recalculateState(INITIAL_STATE, { guests: 240 });
    const food = (s: typeof INITIAL_STATE) => s.categories.find((c) => c.id === "food")?.amount ?? 0;
    expect(next.guests).toBe(240);
    expect(food(next)).toBeGreaterThan(food(INITIAL_STATE));
  });

  it("leaves the venue unchanged when only guests change", () => {
    const next = recalculateState(INITIAL_STATE, { guests: 240 });
    expect(next.categories.find((c) => c.id === "venue")?.amount).toBe(4200);
  });

  it("never drops below the minimum budget or one guest", () => {
    const next = recalculateState(INITIAL_STATE, { budget: 10, guests: 0 });
    expect(next.budget).toBe(1000);
    expect(next.guests).toBe(1);
  });

  it("does not change the original state", () => {
    const before = JSON.stringify(INITIAL_STATE);
    recalculateState(INITIAL_STATE, { guests: 200, budget: 20000 });
    expect(JSON.stringify(INITIAL_STATE)).toBe(before);
  });
});

describe("buildPlanMilestones", () => {
  it("returns four ordered steps with ids and descriptions", () => {
    const ms = buildPlanMilestones("2026-12-20", "Wedding");
    expect(ms.map((m) => m.id)).toEqual(["scope", "venue", "vendors", "run-of-show"]);
    expect(ms.every((m) => m.title && m.description && m.date)).toBe(true);
  });

  it("marks past steps complete, the next one active and later ones upcoming", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    const status = buildPlanMilestones("2026-12-20", "Wedding").map((m) => m.status);
    expect(status).toEqual(["complete", "complete", "active", "upcoming"]);
  });

  it("uses the event type in the first step title", () => {
    expect(buildPlanMilestones("2026-12-20", "Birthday")[0].title).toContain("birthday");
  });
});
