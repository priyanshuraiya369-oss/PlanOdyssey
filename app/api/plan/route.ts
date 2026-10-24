import { NextResponse } from "next/server";
import { z } from "zod";
import { createPlannerResponse, PlannerProviderError } from "@/lib/ai-planner";

const requestSchema = z.object({
  guests: z.number().int().min(1).max(5000),
  budget: z.number().min(1000).max(10000000),
  eventType: z.string().min(1).max(80)
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide a valid guest count, budget, and event type." }, { status: 400 });
    }

    const { guests, budget, eventType } = parsed.data;
    return NextResponse.json(await createPlannerResponse({ guests, budget, eventType }));
  } catch (error) {
    const status = error instanceof PlannerProviderError ? error.status : 502;
    const message = error instanceof Error ? error.message : "The planning engine could not process that request.";
    console.error("[legacy-planner]", JSON.stringify({ status, error: message }));
    return NextResponse.json({ error: message }, { status });
  }
}
