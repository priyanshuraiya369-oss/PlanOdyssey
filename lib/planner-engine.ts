import type { BudgetCategory, Currency, Milestone, PlannerState } from "@/lib/types";

const BASE_CATEGORIES: BudgetCategory[] = [
  { id: "venue", label: "Venue & space", amount: 4200, color: "#7567f8", icon: "building" },
  { id: "food", label: "Food & drinks", amount: 3850, color: "#42b89a", icon: "utensils" },
  { id: "design", label: "Design & florals", amount: 2200, color: "#ff9b75", icon: "sparkles" },
  { id: "photo", label: "Photo & video", amount: 1750, color: "#efc15c", icon: "camera" },
  { id: "music", label: "Music & production", amount: 1250, color: "#70a7ec", icon: "music" }
];

export function buildPlanMilestones(eventDate: string, eventType: string): Milestone[] {
  const eventTime = new Date(`${eventDate}T12:00:00`).getTime();
  const now = Date.now();
  const steps = [
    ["scope", `Confirm the ${eventType.toLowerCase()} brief`, "Lock the guest assumptions, priorities, and non-negotiables."],
    ["venue", "Secure the venue and date", "Confirm availability, deposit terms, access hours, and a backup plan."],
    ["vendors", "Lock the highest-impact vendors", "Request written quotes and compare the categories driving the most spend."],
    ["run-of-show", "Publish the final run of show", "Share timing, responsibilities, contacts, and arrival windows."]
  ] as const;
  const activeIndex = steps.findIndex((step, index) => eventTime - [90, 60, 30, 7][index] * 86_400_000 >= now);
  return steps.map(([id, title, description], index) => {
    const daysBefore = [90, 60, 30, 7][index];
    const time = eventTime - daysBefore * 86_400_000;
    const status = time < now ? "complete" : index === activeIndex ? "active" : "upcoming";
    return {
      id,
      title,
      description,
      date: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(time)),
      status
    };
  });
}

export const INITIAL_STATE: PlannerState = {
  eventName: "Maya & Alex’s celebration",
  eventType: "Wedding",
  eventDate: "2026-12-20",
  location: "Jaipur, Rajasthan",
  guests: 120,
  budget: 16000,
  spent: 11250,
  categories: BASE_CATEGORIES,
  milestones: buildPlanMilestones("2026-12-20", "Wedding"),
  vendors: [
    { id: "v1", vendor: "Clover & Co.", category: "Catering", quote: 3850, rating: 4.9, fit: "Best fit", recommended: true },
    { id: "v2", vendor: "Gather House", category: "Catering", quote: 4200, rating: 4.7, fit: "Strong fit", recommended: false },
    { id: "v3", vendor: "Saffron Table", category: "Catering", quote: 3300, rating: 4.5, fit: "Value pick", recommended: false }
  ],
  currency: "INR",
  validation: { status: "valid", message: "Initial plan loaded.", validatedAt: new Date().toISOString() },
  planValidated: true
};

export function recalculateState(state: PlannerState, changes: Partial<Pick<PlannerState, "budget" | "guests">>): PlannerState {
  const nextBudget = Math.max(1000, changes.budget ?? state.budget);
  const nextGuests = Math.max(1, Math.round(changes.guests ?? state.guests));
  const guestRatio = nextGuests / state.guests;
  const budgetRatio = nextBudget / state.budget;
  const variableRatio = Math.max(0.7, Math.min(1.8, guestRatio * 0.62 + budgetRatio * 0.38));

  const categories = state.categories.map((category) => ({
    ...category,
    amount: Math.round(category.amount * (category.id === "venue" ? budgetRatio : variableRatio))
  }));
  const recalculatedSpent = Math.round(categories.reduce((sum, category) => sum + category.amount, 0) * 0.86);

  return { ...state, budget: nextBudget, guests: nextGuests, spent: recalculatedSpent, categories };
}

export function getBudgetHealth(state: PlannerState) {
  const allocated = state.categories.reduce((sum, category) => sum + category.amount, 0);
  const remaining = state.budget - allocated;
  const percent = state.budget > 0 ? Math.round((allocated / state.budget) * 100) : 0;
  return { remaining, percent, over: remaining < 0 };
}

export function getBudgetAnalytics(state: PlannerState, previous?: PlannerState | null) {
  const allocated = state.categories.reduce((sum, category) => sum + category.amount, 0);
  const budget = Number.isFinite(state.budget) ? state.budget : 0;
  const remaining = budget - allocated;
  const utilization = budget > 0 ? (allocated / budget) * 100 : 0;
  const estimatedSpend = Number.isFinite(state.spent) && state.spent > 0 ? state.spent : null;
  const previousAllocated = previous ? previous.categories.reduce((sum, category) => sum + category.amount, 0) : null;
  return {
    budget,
    allocated,
    estimatedSpend,
    remaining,
    utilization,
    costPerGuest: state.guests > 0 ? allocated / state.guests : null,
    status: budget <= 0 ? "invalid" as const : allocated > budget ? "over" as const : allocated === budget ? "balanced" as const : "under" as const,
    change: previousAllocated === null ? null : allocated - previousAllocated,
    categoryBreakdown: state.categories.map((category) => ({
      ...category,
      percentage: allocated > 0 ? (category.amount / allocated) * 100 : 0
    }))
  };
}

export function formatCurrency(amount: number, currency: Currency = "INR") {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}
