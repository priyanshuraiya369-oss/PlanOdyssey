import { NextResponse } from "next/server";
import { z } from "zod";
import { requestGemini } from "@/lib/gemini-client";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { fitCategories, scheduleMilestones, todayIso } from "@/lib/schedule";

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
  runOfShow: z.array(z.object({ time: z.string().trim().min(1).max(20), title: z.string().trim().min(1).max(160), detail: z.string().trim().max(400).default("") })).max(20).default([]),
  tasks: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
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
  if (!rateLimit(`plans:${clientKey(request)}`, 8, 60_000)) return NextResponse.json({ error: "Too many plan requests. Please wait a minute and try again.", requestId }, { status: 429 });
  try {
    const parsed = planSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Complete all plan fields with valid values." }, { status: 400 });
    const input = parsed.data;
    const today = todayIso(new Date(), "Asia/Kolkata");
    const prompt = `Create a practical, non-generic event plan as JSON for ${input.eventName}. Today's date is ${today}. Event type: ${input.eventType}. Event date: ${input.eventDate}. Location: ${input.location}. Budget: ${input.budget}. Confirmed guests: ${input.confirmedGuests}. Unsure guests: ${input.unsureGuests}. Return exactly these keys: summary (string), budgetAdvice (string), recommendations (array of strings about hotels/venues/vendors and costs in this location), risks (array of strings only if applicable to the date/location, including political events, festivals, weather or other disruptions; otherwise empty), categories (array of objects with label and amount number; amounts should sum to no more than the budget), milestones (array of 4 to 8 objects with title, date, description), runOfShow (array of 8 to 12 objects for the event day with time as 24-hour HH:MM, title, detail), tasks (array of 6 to 10 short action strings), completionWish (string). Every milestone date MUST be formatted YYYY-MM-DD, in ascending order, strictly after ${today} and before ${input.eventDate}; never use a date in the past. Be explicit that live prices, event calendars and weather require verification.`;
    const result = await requestGemini({
      requestId,
      timeoutMs: 45_000,
      maxAttempts: 2,
      body: { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.65, maxOutputTokens: 4000 } }
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
    const finalPlan = { ...validatedPlan.data, categories: fitCategories(validatedPlan.data.categories, input.budget), milestones: scheduleMilestones(validatedPlan.data.milestones, input.eventDate, { tz: "Asia/Kolkata", strict: true }) };
    return NextResponse.json({ input, plan: finalPlan, generatedOn: today });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan generation is temporarily unavailable.";
    console.error("[planner]", JSON.stringify({ requestId, durationMs: Date.now() - startedAt, error: message }));
    return NextResponse.json({ error: message, requestId }, { status: message.includes("API key") ? 503 : 502 });
  }
}