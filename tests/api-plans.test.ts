import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gemini-client", () => ({ requestGemini: vi.fn() }));

import { requestGemini } from "@/lib/gemini-client";
import { POST } from "@/app/api/plans/route";

const mockedGemini = vi.mocked(requestGemini) as unknown as { mockResolvedValue: (v: unknown) => void; mockReset: () => void; mock: { calls: Array<Array<{ body: { contents: Array<{ parts: Array<{ text: string }> }> } }>> } };

const input = { eventName: "Maya's birthday", eventType: "Birthday", eventDate: "2026-11-11", budget: 16000, confirmedGuests: 10, unsureGuests: 2, location: "Jaipur" };
const generated = {
  summary: "An intimate dinner.",
  budgetAdvice: "Spend on food.",
  recommendations: ["Heritage haveli courtyard"],
  risks: [],
  categories: [{ label: "Food", amount: 13000 }, { label: "Cake", amount: 12000 }, { label: "Decor", amount: 1800 }],
  milestones: [
    { title: "Finalize guests", date: "2026-10-11", description: "Confirm the count." },
    { title: "Book venue", date: "2026-10-20", description: "Lock the space." },
    { title: "Order cake", date: "2026-11-04", description: "Place the order." },
    { title: "Final confirmation", date: "2026-11-09", description: "Call every vendor." }
  ],
  runOfShow: [{ time: "18:00", title: "Guests arrive", detail: "Welcome drinks" }],
  tasks: ["Order the cake"],
  completionWish: "Happy birthday!"
};
const geminiReply = (payload: unknown) => ({ response: { ok: true, status: 200, headers: new Headers() }, data: { candidates: [{ content: { parts: [{ text: typeof payload === "string" ? payload : JSON.stringify(payload) }] } }] } });
const post = (body: unknown, ip = "10.1.0.1") => POST(new Request("http://localhost/api/plans", { method: "POST", headers: { "x-forwarded-for": ip, "Content-Type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T06:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mockedGemini.mockReset();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("POST /api/plans", () => {
  it("rejects incomplete input with 400 and never calls Gemini", async () => {
    const res = await post({ eventName: "x" }, "10.1.0.2");
    expect(res.status).toBe(400);
    expect(mockedGemini.mock.calls).toHaveLength(0);
  });

  it("rejects a budget below the minimum", async () => {
    expect((await post({ ...input, budget: 10 }, "10.1.0.3")).status).toBe(400);
  });

  it("tells Gemini today's date and requires ISO milestone dates", async () => {
    mockedGemini.mockResolvedValue(geminiReply(generated));
    await post(input, "10.1.0.4");
    const prompt = mockedGemini.mock.calls[0][0].body.contents[0].parts[0].text;
    expect(prompt).toContain("Today's date is 2026-11-01");
    expect(prompt).toContain("YYYY-MM-DD");
    expect(prompt).toContain("2026-11-11");
  });

  it("moves past milestone dates into the window between today and the event", async () => {
    mockedGemini.mockResolvedValue(geminiReply(generated));
    const body = await (await post(input, "10.1.0.5")).json();
    const dates: string[] = body.plan.milestones.map((m: { date: string }) => m.date);
    expect(dates).toEqual(["2026-11-03", "2026-11-05", "2026-11-07", "2026-11-09"]);
    expect(body.generatedOn).toBe("2026-11-01");
  });

  it("scales allocations down so they never exceed the budget", async () => {
    mockedGemini.mockResolvedValue(geminiReply(generated));
    const body = await (await post(input, "10.1.0.6")).json();
    const total = body.plan.categories.reduce((s: number, c: { amount: number }) => s + c.amount, 0);
    expect(total).toBeLessThanOrEqual(16000);
  });

  it("passes through the run of show, tasks and wish", async () => {
    mockedGemini.mockResolvedValue(geminiReply(generated));
    const res = await post(input, "10.1.0.7");
    const body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    const { plan } = body;
    expect(plan.runOfShow).toHaveLength(1);
    expect(plan.tasks).toEqual(["Order the cake"]);
    expect(plan.completionWish).toBe("Happy birthday!");
  });

  it("accepts JSON wrapped in a markdown code fence", async () => {
    mockedGemini.mockResolvedValue(geminiReply("```json\n" + JSON.stringify(generated) + "\n```"));
    expect((await post(input, "10.1.0.8")).status).toBe(200);
  });

  it("returns 502 for malformed model output", async () => {
    mockedGemini.mockResolvedValue(geminiReply("I cannot help with that"));
    expect((await post(input, "10.1.0.9")).status).toBe(502);
  });

  it("returns 502 when the plan is missing required fields", async () => {
    mockedGemini.mockResolvedValue(geminiReply({ summary: "only a summary" }));
    expect((await post(input, "10.1.1.1")).status).toBe(502);
  });

  it("passes the provider status and message through on failure", async () => {
    mockedGemini.mockResolvedValue({ response: { ok: false, status: 429, headers: new Headers({ "retry-after": "30" }) }, data: { error: { message: "Quota exceeded" } } });
    const res = await post(input, "10.1.1.2");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect((await res.json()).error).toBe("Quota exceeded");
  });

  it("rate limits repeated requests from one client", async () => {
    mockedGemini.mockResolvedValue(geminiReply(generated));
    let last = 200;
    for (let i = 0; i < 9; i++) last = (await post(input, "10.1.1.3")).status;
    expect(last).toBe(429);
  });
});