import { NextResponse } from "next/server";
import { z } from "zod";
import { extractText, GeminiError, requestGemini } from "@/lib/gemini-client";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { todayIso } from "@/lib/schedule";

const MODEL = "gemini-3.5-flash-lite";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(z.object({
    role: z.enum(["user", "model"]),
    parts: z.array(z.object({ text: z.string().max(4000) })).min(1)
  })).max(40).default([]),
  context: z.string().max(3000).optional()
});

const PERSONA =
  "You are PlanOdyssey AI, an expert event command center. Your specialty is complex event money management: " +
  "scenario budgets, cost tradeoffs, vendor comparisons, cash-flow timing, guest-driven cost changes, and realistic risk flags. " +
  "You can also answer greetings, maths, general questions, and writing requests. " +
  "For hotels, venues, political events, festivals, or weather, distinguish estimates from verified facts and tell the user what must be checked live. " +
  "Never repeat canned paragraphs; answer the actual question with useful, specific reasoning.";

function systemInstruction(context?: string): string {
  const today = todayIso(new Date(), "Asia/Kolkata");
  return [PERSONA, `Today's date is ${today}.`, context ? `The user's current plan, for reference:\n${context}` : ""]
    .filter(Boolean)
    .join(" ");
}

export async function POST(request: Request) {
  if (!rateLimit(`chat:${clientKey(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: "You are sending messages quickly. Please wait a few seconds." }, { status: 429 });
  }
  if (!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)) {
    return NextResponse.json({ error: "Gemini API key is not configured on the server." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid message." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid message." }, { status: 400 });
  const { message, history, context } = parsed.data;

  try {
    const result = await requestGemini({
      requestId: crypto.randomUUID(),
      model: MODEL,
      timeoutMs: 30_000,
      maxAttempts: 1,
      body: {
        systemInstruction: { parts: [{ text: systemInstruction(context) }] },
        contents: [...history, { role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.75, maxOutputTokens: 2048 }
      }
    });

    if (!result.response.ok) {
      const data = result.data as { error?: { message?: string } };
      return NextResponse.json(
        { error: data.error?.message || `Gemini request failed (${result.response.status})` },
        { status: result.response.status }
      );
    }

    const answer = extractText(result.data);
    if (!answer) return NextResponse.json({ error: "Gemini returned no text." }, { status: 502 });
    return NextResponse.json({ answer });
  } catch (error) {
    const status = error instanceof GeminiError ? error.status : 502;
    return NextResponse.json({ error: "Gemini is temporarily unavailable. Please try again." }, { status });
  }
}
