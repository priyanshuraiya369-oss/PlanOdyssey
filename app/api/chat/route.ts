import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(z.object({
    role: z.enum(["user", "model"]),
    parts: z.array(z.object({ text: z.string().max(4000) })).min(1)
  })).max(40).default([])
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid message." }, { status: 400 });
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Gemini API key is not configured on the server." }, { status: 503 });
    const history = [...parsed.data.history, { role: "user", parts: [{ text: parsed.data.message }] }];
    const response = await fetch("https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash-lite:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are PlanOdyssey AI, an expert event command center. Your specialty is complex event money management: scenario budgets, cost tradeoffs, vendor comparisons, cash-flow timing, guest-driven cost changes, and realistic risk flags. You can also answer greetings, maths, general questions, and writing requests. For hotels, venues, political events, festivals, or weather, distinguish estimates from verified facts and tell the user what must be checked live. Never repeat canned paragraphs; answer the actual question with useful, specific reasoning." }] },
        contents: history,
        generationConfig: { temperature: 0.75, maxOutputTokens: 2048 }
      }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.error?.message || `Gemini request failed (${response.status})` }, { status: response.status });
    const answer = (data.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part.text || "").join("").trim();
    if (!answer) return NextResponse.json({ error: "Gemini returned no text." }, { status: 502 });
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: "Gemini is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
