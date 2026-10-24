import { z } from "zod";
import type { PlannerResponse } from "@/lib/types";
import { requestGemini } from "@/lib/gemini-client";

const plannerResponseSchema = z.object({
  summary: z.string().min(1),
  insights: z.array(z.object({
    label: z.string().min(1),
    value: z.string().min(1),
    tone: z.enum(["positive", "warning", "neutral"])
  })),
  state: z.record(z.unknown())
});

const geminiResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({ text: z.string() })).min(1)
    })
  })).min(1)
});

export class PlannerProviderError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PlannerProviderError";
    this.status = status;
  }
}

export async function createPlannerResponse(input: { guests: number; budget: number; eventType: string }): Promise<PlannerResponse> {
  const requestId = crypto.randomUUID();
  const result = await requestGemini({
    requestId,
    body: {
      contents: [{ role: "user", parts: [{ text: [
        "Return JSON only with summary, insights, and state.",
        "Do not invent vendor prices or claim live data.",
        `Event type: ${input.eventType}`,
        `Guests: ${input.guests}`,
        `Budget: ${input.budget}`
      ].join("\n") }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 700 }
    }
  });
  const providerData = result.data as { error?: { message?: string } };
  if (!result.response.ok) throw new PlannerProviderError(providerData.error?.message || "Gemini planner request failed.", result.response.status);
  const parsedProvider = geminiResponseSchema.safeParse(result.data);
  if (!parsedProvider.success) throw new PlannerProviderError("Gemini returned an incomplete planner response.", 502);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(parsedProvider.data.candidates[0].content.parts.map((part) => part.text).join(""));
  } catch {
    throw new PlannerProviderError("Gemini returned malformed planner JSON.", 502);
  }
  const parsedPlan = plannerResponseSchema.safeParse(parsedJson);
  if (!parsedPlan.success) throw new PlannerProviderError("Gemini returned a planner response with an unsupported schema.", 502);
  return parsedPlan.data;
}
