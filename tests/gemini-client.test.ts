import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractText, GeminiError, requestGemini } from "@/lib/gemini-client";

const ok = (body: unknown = { candidates: [] }) => new Response(JSON.stringify(body), { status: 200 });
const failure = (code: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { message: `HTTP ${code}` } }), { status: code, headers });
const base = { requestId: "test-1", body: { contents: [] } };

async function catchError(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
    return null;
  } catch (error) {
    return error;
  }
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GOOGLE_API_KEY", "");
  vi.stubEnv("GEMINI_API_URL", "");
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("requestGemini", () => {
  it("refuses to run without an API key, with status 503", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const error = await catchError(() => requestGemini(base));
    expect(error instanceof GeminiError).toBe(true);
    expect((error as GeminiError).status).toBe(503);
  });

  it("returns parsed data after one successful call", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({ hello: "world" })));
    const result = await requestGemini(base);
    expect(result.attempts).toBe(1);
    expect(result.response.status).toBe(200);
    expect(result.data).toEqual({ hello: "world" });
  });

  it("sends the key as a header and uses the requested model in the URL", async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    await requestGemini({ ...base, model: "gemini-3.5-flash-lite" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toContain("models/gemini-3.5-flash-lite:generateContent");
    expect(url).not.toContain("test-key");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
  });

  it("retries a 503 and succeeds on the second attempt", async () => {
    const replies = [failure(503, { "retry-after": "0" }), ok({ done: true })];
    vi.stubGlobal("fetch", vi.fn(async () => replies.shift() as Response));
    const result = await requestGemini(base);
    expect(result.attempts).toBe(2);
    expect(result.response.status).toBe(200);
  });

  it("does not retry a client error such as 400", async () => {
    const fetchMock = vi.fn(async () => failure(400));
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestGemini(base);
    expect(result.response.status).toBe(400);
    expect(result.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the last response once retries run out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => failure(503, { "retry-after": "0" })));
    const result = await requestGemini({ ...base, maxAttempts: 2 });
    expect(result.attempts).toBe(2);
    expect(result.response.status).toBe(503);
  });

  it("throws a GeminiError with status 502 when the network fails on the last attempt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const error = await catchError(() => requestGemini({ ...base, maxAttempts: 1 }));
    expect(error instanceof GeminiError).toBe(true);
    expect((error as GeminiError).status).toBe(502);
  });

  it("reports a timeout as status 504", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      const aborted = new Error("aborted");
      aborted.name = "AbortError";
      throw aborted;
    }));
    const error = await catchError(() => requestGemini({ ...base, maxAttempts: 1 }));
    expect((error as GeminiError).status).toBe(504);
  });
});

describe("extractText", () => {
  it("joins the text parts of the first candidate", () => {
    const data = { candidates: [{ content: { parts: [{ text: "Hello " }, { text: "there" }] } }] };
    expect(extractText(data)).toBe("Hello there");
  });

  it("returns an empty string when there is no text", () => {
    expect(extractText({ candidates: [] })).toBe("");
    expect(extractText({})).toBe("");
  });
});
