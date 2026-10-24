export type BudgetCategory = {
  id: string;
  label: string;
  amount: number;
  color: string;
  icon: string;
};

export type Milestone = {
  id: string;
  title: string;
  date: string;
  description: string;
  status: "complete" | "active" | "upcoming";
};

export type VendorQuote = {
  id: string;
  vendor: string;
  category: string;
  quote: number;
  rating: number;
  fit: string;
  recommended: boolean;
};

export type Currency = "INR" | "USD";
export type ValidationStatus = "draft" | "valid" | "warning" | "invalid";
export type PlanValidation = {
  status: ValidationStatus;
  message: string;
  validatedAt?: string;
};

export type PlannerState = {
  eventName: string;
  eventType: string;
  eventDate: string;
  location: string;
  guests: number;
  budget: number;
  spent: number;
  categories: BudgetCategory[];
  milestones: Milestone[];
  vendors: VendorQuote[];
  currency?: Currency;
  planValidated?: boolean;
  planRisks?: string[];
  completionWish?: string;
  validation?: PlanValidation;
};

export type PlannerInsight = {
  label: string;
  value: string;
  tone: "positive" | "warning" | "neutral";
};

export type PlannerResponse = {
  summary: string;
  insights: PlannerInsight[];
  state: Partial<PlannerState>;
};
