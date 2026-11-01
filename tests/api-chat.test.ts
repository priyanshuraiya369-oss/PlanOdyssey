import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";

const post = (body: unknown, ip = "10.2.0.1") => POST(new Request("http://localhost/api/chat", { method: "POST", headers: { "x-forwarded-for": ip, "Content-Type": "application/json" }, body: JSON.stringify(body) }));
const geminiOk = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T06:00:00Z"));
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GOOGLE_API_KEY", "");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("POST /api/chat", () => {
  it("rejects an empty message with 400", async () => {
    expect((await post({ message: "   " }, "10.2.0.2")).status).toBe(400);
  });

  it("rejects an over-long message", async () => {
    expect((await post({ message: "x".repeat(4001) }, "10.2.0.3")).status).toBe(400);
  });

  it("returns 503 when no API key is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await post({ message: "hello" }, "10.2.0.4");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("API key");
  });

  it("returns the model's answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => geminiOk("Trim the cake budget.")));
    const res = await post({ message: "How do I save money?" }, "10.2.0.5");
    expect(res.status).toBe(200);
    expect((await res.json()).answer).toBe("Trim the cake budget.");
  });

  it("sends the API key as a header, never in the URL", async () => {
    const fetchMock = vi.fn(async () => geminiOk("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await post({ message: "hi" }, "10.2.0.6");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).not.toContain("test-key");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
  });

  it("gives the model today's date, the plan context and the conversation history", async () => {
    const fetchMock = vi.fn(async () => geminiOk("ok"));
    vi.stubGlobal("fetch", fetchMock);
    await post({ message: "And the venue?", context: "Maya's birthday, 12 guests", history: [{ role: "user", parts: [{ text: "Hi" }] }, { role: "model", parts: [{ text: "Hello" }] }] }, "10.2.0.7");
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.systemInstruction.parts[0].text).toContain("2026-11-01");
    expect(body.systemInstruction.parts[0].text).toContain("Maya's birthday, 12 guests");
    expect(body.contents).toHaveLength(3);
    expect(body.contents[2]).toEqual({ role: "user", parts: [{ text: "And the venue?" }] });
  });

  it("passes Gemini error statuses through", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Rate limit" } }), { status: 429 })));
    const res = await post({ message: "hi" }, "10.2.0.8");
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("Rate limit");
  });

  it("returns 502 when Gemini replies with no text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 })));
    expect((await post({ message: "hi" }, "10.2.0.9")).status).toBe(502);
  });

  it("returns 502 when the network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await post({ message: "hi" }, "10.2.1.1")).status).toBe(502);
  });

  it("rate limits a client that chats too fast", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => geminiOk("ok")));
    let last = 200;
    for (let i = 0; i < 21; i++) last = (await post({ message: "hi" }, "10.2.1.2")).status;
    expect(last).toBe(429);
  });
});
