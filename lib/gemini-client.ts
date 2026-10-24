type GeminiRequestOptions = {
  body: unknown;
  timeoutMs?: number;
  maxAttempts?: number;
  requestId: string;
};

type GeminiResult = {
  response: Response;
  data: unknown;
  attempts: number;
};

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function retryAfterMs(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(30_000, Math.max(0, seconds * 1000));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.min(30_000, Math.max(0, date - Date.now())) : null;
}

function backoffMs(attempt: number) {
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(4000, 500 * (2 ** attempt) + jitter);
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 1000) };
  }
}

export async function requestGemini({ body, timeoutMs = 12_000, maxAttempts = 3, requestId }: GeminiRequestOptions): Promise<GeminiResult> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is not configured on the server.");

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const endpoint = process.env.GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`;
  let lastResponse: Response | null = null;
  let lastData: unknown = {};

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store"
      });
      const data = await readJson(response);
      lastResponse = response;
      lastData = data;
      console.info("[gemini]", JSON.stringify({ requestId, model, attempt: attempt + 1, status: response.status, durationMs: Date.now() - startedAt }));
      if (response.ok || !RETRYABLE_STATUSES.has(response.status) || attempt === maxAttempts - 1) {
        return { response, data, attempts: attempt + 1 };
      }
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs(response) ?? backoffMs(attempt)));
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      console.warn("[gemini]", JSON.stringify({ requestId, model, attempt: attempt + 1, error: timedOut ? "timeout" : "network_error", durationMs: Date.now() - startedAt }));
      if (attempt === maxAttempts - 1) throw new Error(timedOut ? "Gemini request timed out." : "Gemini request could not reach the provider.");
      await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastResponse) return { response: lastResponse, data: lastData, attempts: maxAttempts };
  throw new Error("Gemini request failed before receiving a response.");
}
