/**
 * The single place where server routes call Google's Gemini API.
 * Handles the API key, timeouts, retries with backoff, and provider errors.
 */

export class GeminiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

export type GeminiRequest = {
  requestId: string;
  body: unknown;
  model?: string;
  timeoutMs?: number;
  maxAttempts?: number;
};

export type GeminiResult = {
  response: Response;
  data: unknown;
  attempts: number;
};

const DEFAULT_MODEL = "gemini-3.5-flash";
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_WAIT_MS = 30_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function backoffMs(attempt: number): number {
  return Math.min(4_000, 500 * 2 ** attempt + Math.floor(Math.random() * 250));
}

/** Honours Retry-After (seconds or an HTTP date) when the provider sends it. */
function retryDelayMs(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
    if (Number.isFinite(ms)) return Math.min(MAX_WAIT_MS, Math.max(0, ms));
  }
  return backoffMs(attempt);
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 1000) };
  }
}

function endpointFor(model: string): string {
  return process.env.GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`;
}

export async function requestGemini({
  requestId,
  body,
  model = process.env.GEMINI_MODEL || DEFAULT_MODEL,
  timeoutMs = 45_000,
  maxAttempts = 2
}: GeminiRequest): Promise<GeminiResult> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("Gemini API key is not configured on the server.", 503);

  const endpoint = endpointFor(model);
  let last: GeminiResult | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store"
      });
      const data = await parseBody(response);
      console.info("[gemini]", JSON.stringify({ requestId, model, attempt: attempt + 1, status: response.status, durationMs: Date.now() - startedAt }));
      last = { response, data, attempts: attempt + 1 };
      const isLastAttempt = attempt === maxAttempts - 1;
      if (response.ok || isLastAttempt || !RETRYABLE_STATUSES.has(response.status)) return last;
      await sleep(retryDelayMs(response, attempt));
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      console.warn("[gemini]", JSON.stringify({ requestId, model, attempt: attempt + 1, error: timedOut ? "timeout" : "network_error", durationMs: Date.now() - startedAt }));
      if (attempt === maxAttempts - 1) {
        throw timedOut
          ? new GeminiError("Gemini request timed out.", 504)
          : new GeminiError("Gemini request could not reach the provider.", 502);
      }
      await sleep(backoffMs(attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  if (last) return last;
  throw new GeminiError("Gemini request failed before receiving a response.", 502);
}

/** Pulls the generated text out of a Gemini generateContent response. */
export function extractText(data: unknown): string {
  const parsed = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return (parsed.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
}
