import { NextResponse } from "next/server";
import { z } from "zod";
import { requestGemini } from "@/lib/gemini-client";

const planSchema = z.object({
  eventName: z.string().trim().min(2).max(100),
  eventType: z.enum(["Wedding", "Birthday", "Community", "Corporate", "Other"]),
  eventDate: z.string().date(),
  budget: z.number().min(1000).max(100000000),
  confirmedGuests: z.number().int().min(0).max(100000),
  unsureGuests: z.number().int().min(0).max(100000),
  location: z.string().trim().min(2).max(160)
});
const generatedPlanSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
  budgetAdvice: z.string().trim().min(1).max(6000),
  recommendations: z.array(z.string().trim().min(1).max(1000)).max(12).default([]),
  risks: z.array(z.string().trim().min(1).max(1000)).max(12).default([]),
  categories: z.array(z.object({ label: z.string().trim().min(1).max(100), amount: z.coerce.number().finite().nonnegative() })).min(1).max(12),
  milestones: z.array(z.object({ title: z.string().trim().min(1).max(160), date: z.string().trim().min(1).max(80), description: z.string().trim().min(1).max(500) })).max(12).default([]),
  completionWish: z.string().trim().min(1).max(1000)
});

function parseModelJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("No JSON object returned.");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const parsed = planSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Complete all plan fields with valid values." }, { status: 400 });
    const input = parsed.data;
    const prompt = `Create a practical, non-generic event plan as JSON for ${input.eventName}. Event type: ${input.eventType}. Date: ${input.eventDate}. Location: ${input.location}. Budget: ${input.budget}. Confirmed guests: ${input.confirmedGuests}. Unsure guests: ${input.unsureGuests}. Return exactly these keys: summary (string), budgetAdvice (string), recommendations (array of strings about hotels/venues/vendors and costs in this location), risks (array of strings only if applicable to the date/location, including political events, festivals, weather or other disruptions; otherwise empty), categories (array of objects with label and amount number), milestones (array of objects with title, date, description ordered by due date and tailored to this event/date), completionWish (string). Be explicit that live prices, event calendars and weather require verification.`;
    const result = await requestGemini({
      requestId,
      body: { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.65, maxOutputTokens: 1800 } }
    });
    const { response, data } = result;
    const providerData = data as { error?: { message?: string } };
    if (!response.ok) {
      const headers = new Headers();
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter) headers.set("Retry-After", retryAfter);
      return NextResponse.json({ error: providerData.error?.message || "Gemini plan generation failed.", requestId }, { status: response.status, headers });
    }
    const modelData = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = (modelData.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("").trim();
    if (!text) return NextResponse.json({ error: "Gemini returned no plan." }, { status: 502 });
    let plan: unknown;
    try { plan = parseModelJson(text); } catch { return NextResponse.json({ error: "Gemini returned malformed plan JSON. Please retry once." }, { status: 502 }); }
    const validatedPlan = generatedPlanSchema.safeParse(plan);
    if (!validatedPlan.success) return NextResponse.json({ error: "Gemini returned an incomplete plan. Please try again." }, { status: 502 });
    return NextResponse.json({ input, plan: validatedPlan.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan generation is temporarily unavailable.";
    console.error("[planner]", JSON.stringify({ requestId, durationMs: Date.now() - startedAt, error: message }));
    return NextResponse.json({ error: message, requestId }, { status: message.includes("API key") ? 503 : 502 });
  }
}
