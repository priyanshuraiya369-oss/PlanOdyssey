"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, Bell, Building2, CalendarDays, Camera, Check, ChevronDown, CircleHelp, Clock3,
  Command, CreditCard, DollarSign, FileText, Globe2, Home, IndianRupee, LogOut, Mail, MapPin, Menu, MessageCircle,
  Mic2, MoreHorizontal, Music2, PanelLeft, Phone, Plus, QrCode, Search, Send, Settings2, ShieldCheck,
  Sparkles, Star, Sun, TicketCheck, TrendingUp, UserRound, Users, WalletCards, X
} from "lucide-react";
import { buildPlanMilestones, formatCurrency, getBudgetAnalytics, getBudgetHealth, INITIAL_STATE } from "@/lib/planner-engine";
import type { BudgetCategory, Currency, Milestone, PlannerState } from "@/lib/types";

type Modal = "auth" | "subscription" | "chat" | "create-plan" | "settings" | "profile" | "feedback" | "help" | null;
type AuthStage = "login" | "register";
type GoogleCredentialResponse = { credential: string };
type GoogleAccounts = { id: { initialize: (options: { client_id: string; ux_mode: "popup"; callback: (response: GoogleCredentialResponse) => void }) => void; renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number; text: string }) => void } };
declare global { interface Window { google?: { accounts: GoogleAccounts }; } }

const workspaceItems = [
  { label: "Overview", icon: Home },
  { label: "Budget", icon: IndianRupee },
  { label: "Guests", icon: Users },
  { label: "Vendors", icon: Sparkles },
  { label: "Timeline", icon: CalendarDays },
  { label: "Documents", icon: FileText }
];
const utilityItems = [
  { label: "AI concierge", icon: MessageCircle, modal: "chat" as Modal },
  { label: "Plans & subscription", icon: CreditCard, modal: "subscription" as Modal },
  { label: "Feedback & improvements", icon: TrendingUp, modal: "feedback" as Modal },
  { label: "Contact us", icon: Phone, modal: "help" as Modal }
];
const iconMap = { building: PanelLeft, utensils: WalletCards, sparkles: Sparkles, camera: Camera, music: Music2 };
const DRAFT_STORAGE_KEY = "planodyssey.current-plan";

function readStoredPlan() {
  if (typeof window === "undefined") return INITIAL_STATE;
  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) return INITIAL_STATE;
    const parsed = JSON.parse(stored) as Partial<PlannerState>;
    return parsed.eventName && Array.isArray(parsed.categories)
      ? { ...INITIAL_STATE, ...parsed, milestones: buildPlanMilestones(parsed.eventDate || INITIAL_STATE.eventDate, parsed.eventType || INITIAL_STATE.eventType) }
      : INITIAL_STATE;
  } catch {
    return INITIAL_STATE;
  }
}

function readStoredValidatedPlan() {
  const plan = readStoredPlan();
  return plan.validation?.status === "valid" || plan.validation?.status === "warning" ? plan : INITIAL_STATE;
}

export default function Dashboard() {
  const [state, setState] = useState<PlannerState>(() => readStoredPlan());
  const [active, setActive] = useState("Overview");
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [intro, setIntro] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [toast, setToast] = useState("");
  const [profile, setProfile] = useState({ name: "Priyanshu Raiya", email: "priyanshu@example.com" });
  const [theme, setTheme] = useState<"light" | "dim">("light");
  const [lastValidatedPlan, setLastValidatedPlan] = useState<PlannerState>(() => readStoredValidatedPlan());
  const [previousValidatedPlan, setPreviousValidatedPlan] = useState<PlannerState | null>(null);
  const health = useMemo(() => getBudgetHealth(state), [state]);
  const analytics = useMemo(() => getBudgetAnalytics(state, previousValidatedPlan), [state, previousValidatedPlan]);
  const isDirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(lastValidatedPlan), [state, lastValidatedPlan]);

  useEffect(() => { const timer = window.setTimeout(() => setIntro(false), 2200); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    if (authError) notify(authError);
    void fetch("/api/auth/session").then((response) => response.json()).then((data: { signedIn?: boolean; profile?: { name: string; email: string } }) => {
      if (data.signedIn && data.profile) { setSignedIn(true); setProfile(data.profile); }
    }).catch(() => undefined);
  }, []);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };
  const updateNumber = (key: "budget" | "guests", value: string) => {
    const numeric = Number(value);
    if (value === "" || Number.isFinite(numeric)) setState((current) => ({ ...current, [key]: value === "" ? 0 : numeric, planValidated: false, validation: { status: "draft", message: "Unsaved changes." } }));
  };
  const updateCategory = (id: string, value: string) => {
    const numeric = Number(value);
    if (value === "" || Number.isFinite(numeric)) setState((current) => ({ ...current, categories: current.categories.map((category) => category.id === id ? { ...category, amount: value === "" ? 0 : numeric } : category), planValidated: false, validation: { status: "draft", message: "Unsaved changes." } }));
  };
  const updateCurrency = (value: string) => {
    if (value === "INR" || value === "USD") setState((current) => ({ ...current, currency: value as Currency, planValidated: false, validation: { status: "draft", message: "Unsaved changes." } }));
  };
  const validatePlan = (candidate: PlannerState = state) => {
    const errors: string[] = [];
    if (!candidate.eventName.trim() || !candidate.eventDate || !candidate.location.trim()) errors.push("Event name, date, and location are required.");
    if (!Number.isFinite(candidate.budget) || candidate.budget <= 0) errors.push("Total budget must be greater than zero.");
    if (!Number.isFinite(candidate.guests) || candidate.guests <= 0) errors.push("Guest count must be greater than zero.");
    if (candidate.categories.some((category) => !Number.isFinite(category.amount) || category.amount < 0)) errors.push("Allocations cannot be negative or invalid.");
    if (errors.length) {
      const invalid = { ...candidate, planValidated: false, validation: { status: "invalid" as const, message: errors.join(" ") } };
      setState(invalid);
      notify("Fix the highlighted plan fields before validating.");
      return;
    }
    const allocated = candidate.categories.reduce((sum, category) => sum + category.amount, 0);
    const overage = allocated - candidate.budget;
    const status = overage > 0 ? "warning" as const : "valid" as const;
    const message = overage > 0 ? `${formatCurrency(overage, candidate.currency)} over budget. The plan is validated with a warning.` : `${formatCurrency(candidate.budget - allocated, candidate.currency)} remains unallocated.`;
    const validated = { ...candidate, planValidated: true, validation: { status, message, validatedAt: new Date().toISOString() } };
    setPreviousValidatedPlan(lastValidatedPlan);
    setLastValidatedPlan(validated);
    setState(validated);
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(validated));
    notify(overage > 0 ? "Plan validated with an overspending warning." : "Plan validated and analytics refreshed.");
  };
  const restorePlan = () => {
    setState(lastValidatedPlan);
    notify("Restored the previous validated plan.");
  };
  const saveDraft = () => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
    notify("Draft saved on this device. Validate it to confirm the plan.");
  };
  const applyGeneratedPlan = (plan: Partial<PlannerState>) => {
    const next = { ...state, spent: 0, ...plan };
    if (!plan.milestones) next.milestones = buildPlanMilestones(next.eventDate, next.eventType);
    setState(next);
    validatePlan(next);
  };

  return (
    <main className={`aurora-shell ${theme === "dim" ? "bg-[#eef0f7]" : "bg-canvas"} relative min-h-screen overflow-hidden transition-colors`}>
      <div className="particle-field" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      {intro && <div onAnimationEnd={() => setIntro(false)} className="intro-screen fixed inset-0 z-[100] grid place-items-center bg-ink text-white"><div className="text-center"><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-lavender shadow-soft"><Command size={30} /></div><h1 className="text-3xl font-bold tracking-[-.05em]">PlanOdyssey</h1><p className="mt-2 text-sm text-white/55">Your celebration, intelligently orchestrated.</p></div></div>}
      <div className="mx-auto flex min-h-screen max-w-[1540px]">
        <aside className={`sidebar-shell ${mobileNav ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-line bg-white px-5 py-7 transition-transform lg:static lg:translate-x-0`}>
          <div className="mb-9 flex items-center justify-between px-2"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white"><Command size={18} /></div><div><p className="text-[15px] font-bold">PlanOdyssey</p><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate">Command center</p></div></div><button className="lg:hidden" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate">Workspace</p>
          <nav className="space-y-1">{workspaceItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActive(label); setMobileNav(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${active === label ? "bg-[#efedff] text-lavender" : "text-slate hover:bg-canvas hover:text-ink"}`}><Icon size={17} />{label}{label === "Vendors" && <span className="ml-auto rounded-full bg-[#e6f7f2] px-2 py-0.5 text-[10px] text-mint">3</span>}</button>)}</nav>
          <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate">More</p>
          <nav className="space-y-1">{utilityItems.map(({ label, icon: Icon, modal: target }) => <button key={label} onClick={() => setModal(target)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate transition hover:bg-canvas hover:text-ink"><Icon size={17} />{label}</button>)}</nav>
          <div className="mt-auto space-y-1"><button onClick={() => setModal("settings")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate hover:bg-canvas"><Settings2 size={17} />Settings</button><button onClick={() => setModal("help")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate hover:bg-canvas"><CircleHelp size={17} />Help center</button><button onClick={() => setModal("profile")} className="mt-4 flex w-full items-center gap-3 border-t border-line px-2 pt-5 text-left"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#f3d6c8] text-sm font-bold text-[#825945]">{profile.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{profile.name}</p><p className="text-xs text-slate">{signedIn ? "Verified profile" : "Guest profile"}</p></div><MoreHorizontal size={17} className="ml-auto text-slate" /></button></div>
        </aside>
        {mobileNav && <button aria-label="Close menu overlay" className="fixed inset-0 z-30 bg-ink/20 lg:hidden" onClick={() => setMobileNav(false)} />}

        <section className="content-shell min-w-0 flex-1 px-5 py-5 sm:px-8 lg:px-12 lg:py-8">
          <header className="topbar-shell mb-9 flex items-center justify-between gap-4"><button className="rounded-lg p-2 hover:bg-white lg:hidden" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div className="relative hidden max-w-[350px] flex-1 sm:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" size={17} /><input aria-label="Search workspace" className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-lavender" placeholder="Search your workspace" /></div><div className="ml-auto flex items-center gap-3"><button onClick={() => notify("No new alerts for this plan.")} aria-label="View plan alerts" className="relative rounded-xl border border-line bg-white p-2.5 text-slate shadow-card"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-peach" /></button>{signedIn ? <button onClick={() => setModal("profile")} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold"><div className="grid h-6 w-6 place-items-center rounded-full bg-[#f3d6c8] text-[9px] text-[#825945]">{profile.name.slice(0, 2).toUpperCase()}</div>{profile.name.split(" ")[0]}</button> : <button onClick={() => setModal("auth")} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs font-bold text-ink"><UserRound size={15} className="text-lavender" />Sign in</button>}<button onClick={() => setModal("chat")} className="flex items-center gap-2 rounded-xl bg-ink px-3.5 py-2.5 text-xs font-bold text-white shadow-card hover:bg-[#2a3550]"><Sparkles size={15} />Ask Odyssey</button></div></header>
          {active === "Overview" ? <Overview state={state} health={health} analytics={analytics} isDirty={isDirty} onValidate={() => validatePlan()} onRestore={restorePlan} onOpenTimeline={() => setActive("Timeline")} setModal={setModal} /> : <WorkspaceView active={active} state={state} health={health} analytics={analytics} isDirty={isDirty} onValidate={() => validatePlan()} onRestore={restorePlan} onSave={saveDraft} setModal={setModal} updateNumber={updateNumber} updateCategory={updateCategory} updateCurrency={updateCurrency} />}
        </section>
      </div>
      {toast && <div className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-soft"><Check size={16} className="text-mint" />{toast}</div>}
      {modal === "auth" && <AuthModal onClose={() => setModal(null)} onSignedIn={(next) => { setProfile(next); setSignedIn(true); setModal(null); notify("Your verified profile is ready."); }} />}
      {modal === "subscription" && <SubscriptionModal onClose={() => setModal(null)} onPaid={() => { setModal("chat"); notify("Demo Pro access unlocked for 180 seconds."); }} />}
      {modal === "chat" && <ChatModal onClose={() => setModal(null)} onPaywall={() => setModal("subscription")} />}
      {modal === "create-plan" && <CreatePlanModal onClose={() => setModal(null)} onCreated={(plan) => { applyGeneratedPlan(plan); setModal(null); }} />}
      {modal === "settings" && <SettingsModal theme={theme} setTheme={setTheme} onClose={() => setModal(null)} onLogout={() => { setSignedIn(false); setModal(null); notify("You have been signed out."); }} />}
      {modal === "profile" && <ProfileModal profile={profile} signedIn={signedIn} onClose={() => setModal(null)} onSignIn={() => setModal("auth")} />}
      {modal === "feedback" && <FeedbackModal onClose={() => setModal(null)} onDone={() => { setModal(null); notify("Thanks — your idea was added to the improvement queue."); }} />}
      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
    </main>
  );
}

function Overview({ state, health, analytics, isDirty, onValidate, onRestore, onOpenTimeline, setModal }: { state: PlannerState; health: ReturnType<typeof getBudgetHealth>; analytics: ReturnType<typeof getBudgetAnalytics>; isDirty: boolean; onValidate: () => void; onRestore: () => void; onOpenTimeline: () => void; setModal: (modal: Modal) => void }) {
  const largest = analytics.categoryBreakdown.reduce((current, item) => item.amount > current.amount ? item : current, analytics.categoryBreakdown[0]);
  const insight = largest ? `${largest.label} is ${Math.round(largest.percentage)}% of your current allocation. ${analytics.remaining < 0 ? `Trim at least ${formatCurrency(Math.abs(analytics.remaining), state.currency)} before confirming another booking.` : `You still have ${formatCurrency(analytics.remaining, state.currency)} available for unresolved decisions.`}` : "Add allocations to unlock plan-specific financial guidance.";
  return <><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate"><span>My events</span><ChevronDown size={13} /></div><h1 className="text-3xl font-bold tracking-[-.04em] text-ink sm:text-[38px]">{state.eventName}</h1><p className="mt-2 flex items-center gap-2 text-sm text-slate"><CalendarDays size={15} />{state.eventDate} · {state.location} <span className="text-line">•</span> <span className="text-mint">Plan data synced</span></p></div><button onClick={() => setModal("create-plan")} className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold shadow-card hover:border-lavender"><Plus size={17} className="text-lavender" />Create plan</button></div><PlanCountdown state={state} /><AnalyticsDashboard state={state} analytics={analytics} isDirty={isDirty} onValidate={onValidate} onRestore={onRestore} /><div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Timeline state={state} onViewAll={onOpenTimeline} /><div className="space-y-5"><section className="rounded-3xl border border-[#e5e2ff] bg-[#f2f0ff] p-6 shadow-card sm:p-7"><div className="mb-4 flex items-center gap-2 text-lavender"><Sparkles size={17} /><p className="text-xs font-bold uppercase tracking-[.14em]">Plan intelligence</p></div><p className="text-[17px] font-bold leading-7 text-ink">{insight}</p><button onClick={() => setModal("chat")} className="mt-5 flex items-center gap-2 text-xs font-bold text-lavender">Ask about this allocation <ArrowUpRight size={14} /></button></section><VendorCard state={state} /></div></div></>;
}

function AnalyticsDashboard({ state, analytics, isDirty, onValidate, onRestore }: { state: PlannerState; analytics: ReturnType<typeof getBudgetAnalytics>; isDirty: boolean; onValidate: () => void; onRestore: () => void }) {
  const [selectedId, setSelectedId] = useState(state.categories[0]?.id ?? "");
  const selected = analytics.categoryBreakdown.find((category) => category.id === selectedId) ?? analytics.categoryBreakdown[0];
  const currency = state.currency;
  const status = analytics.status === "over" ? "Over budget" : analytics.status === "balanced" ? "Fully allocated" : analytics.status === "invalid" ? "Needs valid budget" : "Under budget";
  const statusClass = analytics.status === "over" || analytics.status === "invalid" ? "bg-[#fff0ed] text-[#c75d45]" : "bg-[#e6f7f2] text-mint";
  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">Budget analytics</h2>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>{status}</span>
          </div>
          <p className="mt-1 text-sm text-slate">Calculated from the current editable plan, not sample metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && <span className="rounded-full bg-[#fff8ee] px-3 py-2 text-xs font-bold text-[#8c6237]">Unsaved changes</span>}
          <button onClick={onRestore} disabled={!isDirty} className="rounded-xl border border-line px-3 py-2 text-xs font-bold text-slate disabled:cursor-not-allowed disabled:opacity-40">Restore</button>
          <button onClick={onValidate} className="rounded-xl bg-ink px-3 py-2 text-xs font-bold text-white">Validate plan</button>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[["Total budget", formatCurrency(analytics.budget, currency)], ["Allocated", formatCurrency(analytics.allocated, currency)], ["Estimated spend", analytics.estimatedSpend === null ? "Unavailable" : formatCurrency(analytics.estimatedSpend, currency)], ["Remaining", formatCurrency(analytics.remaining, currency)], ["Utilization", `${Math.round(analytics.utilization)}%`]].map(([label, value]) => <div key={label} className="rounded-2xl border border-line bg-[#fbfcfe] p-4"><p className="text-xs font-semibold text-slate">{label}</p><p className={`mt-2 text-lg font-bold ${label === "Remaining" && analytics.remaining < 0 ? "text-[#c75d45]" : "text-ink"}`}>{value}</p></div>)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-bold">Budget versus allocation</h3><p className="text-xs text-slate">Target and current category total</p></div><span className="text-xs font-bold text-slate">{formatCurrency(analytics.allocated, currency)} / {formatCurrency(analytics.budget, currency)}</span></div>
          <div className="relative h-5 rounded-full bg-[#edf0f5]"><div className={`h-full rounded-full transition-all ${analytics.status === "over" ? "bg-[#e98269]" : "bg-lavender"}`} style={{ width: `${Math.min(100, Math.max(0, analytics.utilization))}%` }} /></div>
          <div className="mt-2 flex justify-between text-[11px] text-slate"><span>0</span><span>{formatCurrency(analytics.budget, currency)} target</span></div>
          <p className="mb-2 mt-6 text-xs font-bold text-slate">Category allocation</p>
          <div className="flex h-36 items-end gap-2 rounded-2xl border border-line bg-[#fbfcfe] p-4">
            {analytics.categoryBreakdown.map((category) => <button key={category.id} onClick={() => setSelectedId(category.id)} aria-label={`View ${category.label}`} className={`group relative flex-1 rounded-t-lg transition-all ${selected?.id === category.id ? "ring-2 ring-lavender ring-offset-2" : "opacity-75 hover:opacity-100"}`} style={{ height: `${Math.max(8, analytics.allocated > 0 ? category.amount / Math.max(...analytics.categoryBreakdown.map((item) => item.amount), 1) * 100 : 8)}%`, backgroundColor: category.color }}><span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[10px] text-white group-hover:block">{formatCurrency(category.amount, currency)}</span></button>)}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-bold">Category spending breakdown</h3><p className="text-xs text-slate">Select a bar for details</p></div><span className="text-xs font-bold text-slate">{selected ? `${Math.round(selected.percentage)}%` : "—"}</span></div>
          {selected ? <div className="rounded-2xl border border-line bg-[#fbfcfe] p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{selected.label}</p><p className="mt-1 text-xs text-slate">{Math.round(selected.percentage)}% of allocated budget</p></div><p className="text-lg font-bold">{formatCurrency(selected.amount, currency)}</p></div><div className="mt-4 h-2 rounded-full bg-[#edf0f5]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, selected.percentage)}%`, backgroundColor: selected.color }} /></div></div> : <div className="rounded-2xl border border-dashed border-line p-6 text-sm text-slate">No allocation data yet.</div>}
          <div className="mt-4 space-y-2">{analytics.categoryBreakdown.map((category) => <button key={category.id} onClick={() => setSelectedId(category.id)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs ${selected?.id === category.id ? "bg-[#efedff]" : "hover:bg-canvas"}`}><span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} /><span className="truncate font-semibold">{category.label}</span></span><span className="font-bold">{formatCurrency(category.amount, currency)}</span></button>)}</div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-3"><div><p className="text-xs text-slate">Cost per guest</p><p className="mt-1 font-bold">{analytics.costPerGuest === null ? "Unavailable" : formatCurrency(analytics.costPerGuest, currency)}</p></div><div><p className="text-xs text-slate">Since previous validated plan</p><p className={`mt-1 font-bold ${analytics.change !== null && analytics.change > 0 ? "text-[#c75d45]" : "text-mint"}`}>{analytics.change === null ? "No comparison yet" : `${analytics.change >= 0 ? "+" : ""}${formatCurrency(analytics.change, currency)}`}</p></div><div><p className="text-xs text-slate">Validation</p><p className="mt-1 font-bold">{state.validation?.message ?? "Draft — validate to confirm"}</p></div></div>
    </section>
  );
}

function PlanCountdown({ state }: { state: PlannerState }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(state.eventDate).getTime() - Date.now()));
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(Math.max(0, new Date(state.eventDate).getTime() - Date.now())), 1000);
    return () => window.clearInterval(timer);
  }, [state.eventDate]);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return <section className="mb-5 overflow-hidden rounded-3xl border border-[#dedaff] bg-gradient-to-r from-[#f4f1ff] via-white to-[#eafaf5] p-5 shadow-card sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-lavender"><Clock3 size={15} />Countdown to your event</div><p className="mt-2 text-sm text-slate">{state.planValidated ? "Your validated plan is now on the runway." : "Create and validate a plan to begin the live countdown."}</p></div>{state.planValidated && <div className="flex gap-2 text-center">{[[days, "days"], [hours, "hrs"], [minutes, "min"], [seconds, "sec"]].map(([value, label]) => <div key={label} className="min-w-14 rounded-xl bg-white px-2 py-2 shadow-card"><p className="text-xl font-bold text-ink">{value}</p><p className="text-[9px] font-bold uppercase text-slate">{label}</p></div>)}</div>}</div>{state.planValidated && remaining === 0 && <div className="mt-4 rounded-2xl bg-[#e6f7f2] p-3 text-sm font-semibold text-mint"><Sparkles size={15} className="mr-1 inline" />{state.completionWish || "Wishing you a beautiful celebration filled with wonderful memories!"}</div>}</section>;
}

function BudgetCard({ state, health }: { state: PlannerState; health: ReturnType<typeof getBudgetHealth> }) {
  const analytics = getBudgetAnalytics(state);
  return <section className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-7"><div className="mb-6 flex items-start justify-between"><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold">Budget pulse</h2><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${health.over ? "bg-[#fff0ed] text-[#d5634d]" : "bg-[#e6f7f2] text-mint"}`}>{health.over ? "Needs attention" : "On track"}</span></div><p className="mt-1 text-sm text-slate">Live allocation across your celebration</p></div><MoreHorizontal size={20} className="text-slate" /></div><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-3xl font-bold">{formatCurrency(analytics.allocated, state.currency)}</p><p className="mt-1 text-xs text-slate">of {formatCurrency(state.budget, state.currency)} allocated</p></div><p className={`text-sm font-bold ${health.over ? "text-[#d5634d]" : "text-mint"}`}>{health.over ? formatCurrency(Math.abs(health.remaining), state.currency) + " over" : formatCurrency(health.remaining, state.currency) + " remaining"}</p></div><div className="mb-7 h-3 overflow-hidden rounded-full bg-[#f0f1f6]"><div className={`h-full rounded-full transition-all duration-500 ${health.over ? "bg-peach" : "bg-lavender"}`} style={{ width: `${Math.min(100, Math.max(0, health.percent))}%` }} /></div><div className="grid gap-4 sm:grid-cols-2">{state.categories.map((category) => { const Icon = iconMap[category.icon as keyof typeof iconMap] ?? Sparkles; return <div className="flex items-center gap-3" key={category.id}><div className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: `${category.color}18`, color: category.color }}><Icon size={16} /></div><div className="min-w-0 flex-1"><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate font-semibold">{category.label}</span><span className="font-bold">{formatCurrency(category.amount, state.currency)}</span></div><div className="h-1.5 rounded-full bg-[#f0f1f6]"><div className="h-full rounded-full" style={{ width: `${analytics.allocated > 0 ? Math.min(100, category.amount / analytics.allocated * 100) : 0}%`, backgroundColor: category.color }} /></div></div></div> })}</div></section>;
}

function Timeline({ state, onViewAll }: { state: PlannerState; onViewAll?: () => void }) {
  return <section className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-7"><div className="mb-6 flex items-start justify-between"><div><h2 className="text-lg font-bold">Next up</h2><p className="mt-1 text-sm text-slate">Derived from {state.eventType} on {state.eventDate}</p></div>{onViewAll && <button onClick={onViewAll} className="text-xs font-bold text-lavender hover:underline">View all</button>}</div>{state.milestones.length ? <div className="space-y-5">{state.milestones.map((item, index) => <div className="flex gap-3" key={item.id}><div className="flex flex-col items-center"><div className={`grid h-7 w-7 place-items-center rounded-full ${item.status === "complete" ? "bg-mint text-white" : item.status === "active" ? "border-2 border-lavender bg-[#efedff] text-lavender" : "border border-line bg-white text-slate"}`}>{item.status === "complete" ? <Check size={14} /> : <span className="h-2 w-2 rounded-full bg-lavender" />}</div>{index < state.milestones.length - 1 && <div className="my-1 h-full w-px bg-line" />}</div><div className="pb-5"><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate">{item.description}</p><p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-slate"><Clock3 size={12} />{item.date}</p></div></div>)}</div> : <EmptyState title="No timeline returned" message="Generate or edit a plan to create event-specific milestones." />}</section>;
}
function VendorCard({ state }: { state: PlannerState }) { return <section className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-7"><div className="mb-5"><h2 className="text-lg font-bold">Vendor shortlist</h2><p className="mt-1 text-sm text-slate">Catering · 3 options</p></div>{state.vendors.map((vendor) => <div key={vendor.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff5e9] text-peach"><WalletCards size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{vendor.vendor}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate"><Star size={11} className="fill-[#efc15c] text-[#efc15c]" />{vendor.rating} · {vendor.fit}</p></div><p className="text-sm font-bold">{formatCurrency(vendor.quote)}</p></div>)}</section>; }

function PlanEditor({ state, analytics, isDirty, onValidate, onRestore, onSave, updateNumber, updateCategory, updateCurrency }: { state: PlannerState; analytics: ReturnType<typeof getBudgetAnalytics>; isDirty: boolean; onValidate: () => void; onRestore: () => void; onSave: () => void; updateNumber: (key: "budget" | "guests", value: string) => void; updateCategory: (id: string, value: string) => void; updateCurrency: (value: string) => void }) {
  return <section className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Plan editor</h2><p className="mt-1 text-sm text-slate">AI suggestions stay editable until you validate the current numbers.</p></div>{isDirty && <span className="rounded-full bg-[#fff8ee] px-3 py-2 text-xs font-bold text-[#8c6237]">Unsaved changes</span>}</div><div className="mt-6 grid gap-4 sm:grid-cols-3"><label className="text-xs font-bold text-slate">Total event budget<input type="number" min="0" value={state.budget} onChange={(event) => updateNumber("budget", event.target.value)} className="mt-2 w-full rounded-xl border border-line px-3 py-3 font-bold outline-none focus:border-lavender" /></label><label className="text-xs font-bold text-slate">Guest count<input type="number" min="0" value={state.guests} onChange={(event) => updateNumber("guests", event.target.value)} className="mt-2 w-full rounded-xl border border-line px-3 py-3 font-bold outline-none focus:border-lavender" /></label><label className="text-xs font-bold text-slate">Currency<select value={state.currency ?? "INR"} onChange={(event) => updateCurrency(event.target.value)} className="mt-2 w-full rounded-xl border border-line px-3 py-3 font-bold outline-none focus:border-lavender"><option value="INR">Indian rupee (INR)</option><option value="USD">US dollar (USD)</option></select></label></div><div className="mt-6 space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Budget allocations</h3><span className={`text-xs font-bold ${analytics.remaining < 0 ? "text-[#c75d45]" : "text-slate"}`}>{analytics.remaining < 0 ? `${formatCurrency(Math.abs(analytics.remaining), state.currency)} over` : `${formatCurrency(analytics.remaining, state.currency)} unallocated`}</span></div>{state.categories.map((category) => <label key={category.id} className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-3 text-sm"><span className="truncate font-semibold">{category.label}</span><input type="number" min="0" value={category.amount} onChange={(event) => updateCategory(category.id, event.target.value)} className="w-full rounded-xl border border-line px-3 py-2 text-right font-bold outline-none focus:border-lavender" /></label>)}</div>{state.validation?.status === "warning" && <p className="mt-4 rounded-xl bg-[#fff1ed] p-3 text-xs font-semibold text-[#c75d45]">{state.validation.message}</p>}{state.validation?.status === "invalid" && <p className="mt-4 rounded-xl bg-[#fff1ed] p-3 text-xs font-semibold text-[#c75d45]">{state.validation.message}</p>}<div className="mt-6 flex flex-wrap gap-3"><button onClick={onSave} className="rounded-xl border border-line px-4 py-3 text-xs font-bold text-slate">Save changes</button><button onClick={onRestore} disabled={!isDirty} className="rounded-xl border border-line px-4 py-3 text-xs font-bold text-slate disabled:opacity-40">Discard edits</button><button onClick={onValidate} className="rounded-xl bg-ink px-4 py-3 text-xs font-bold text-white">Validate plan</button></div></section>;
}

function WorkspaceView({ active, state, health, analytics, isDirty, onValidate, onRestore, onSave, setModal, updateNumber, updateCategory, updateCurrency }: { active: string; state: PlannerState; health: ReturnType<typeof getBudgetHealth>; analytics: ReturnType<typeof getBudgetAnalytics>; isDirty: boolean; onValidate: () => void; onRestore: () => void; onSave: () => void; setModal: (m: Modal) => void; updateNumber: (key: "budget" | "guests", value: string) => void; updateCategory: (id: string, value: string) => void; updateCurrency: (value: string) => void }) {
  const titles: Record<string, string> = { Budget: "Budget studio", Guests: "Guest command", Vendors: "Vendor marketplace", Timeline: "Milestone timeline", Documents: "Event documents" };
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-lavender">Workspace / {active}</p><h1 className="text-3xl font-bold tracking-[-.04em] sm:text-[38px]">{titles[active]}</h1><p className="mt-2 text-sm text-slate">Everything for {state.eventName}, in one focused view.</p></div>
        <button onClick={() => setModal("chat")} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white"><Sparkles size={16} />Ask Odyssey</button>
      </div>
      {active === "Budget" && (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <PlanEditor state={state} analytics={analytics} isDirty={isDirty} onValidate={onValidate} onRestore={onRestore} onSave={onSave} updateNumber={updateNumber} updateCategory={updateCategory} updateCurrency={updateCurrency} />
        </div>
      )}
      {active === "Guests" && <DataGrid icon={<Users />} heading={`${state.guests} planned guests`} sub="The current plan contains a total guest assumption, but no RSVP records yet." rows={[]} emptyText="No RSVP records have been added. Connect your guest list when you have confirmed names." />}
      {active === "Vendors" && <DataGrid icon={<Building2 />} heading="Shortlisted partners" sub="Compare quotes, fit, ratings, and availability" rows={state.vendors.map((v) => `${v.vendor} · ${formatCurrency(v.quote)} · ${v.rating}★`)} />}
      {active === "Timeline" && <Timeline state={state} />}
      {active === "Documents" && <DataGrid icon={<FileText />} heading="Your event library" sub="A calm home for contracts, quotes, and briefs" rows={[]} emptyText="No documents are connected to this plan yet." />}
    </div>
  );
}
function EmptyState({ title, message }: { title: string; message: string }) { return <div className="rounded-2xl border border-dashed border-line bg-[#fbfcfe] p-6 text-center"><p className="text-sm font-bold text-ink">{title}</p><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate">{message}</p></div>; }
function DataGrid({ icon, heading, sub, rows, emptyText }: { icon: React.ReactNode; heading: string; sub: string; rows: string[]; emptyText?: string }) { return <section className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8"><div className="mb-6 flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#efedff] text-lavender">{icon}</div><div><h2 className="text-xl font-bold">{heading}</h2><p className="mt-1 text-sm text-slate">{sub}</p></div></div>{rows.length ? <div className="divide-y divide-line rounded-2xl border border-line">{rows.map((row) => <div key={row} className="flex items-center justify-between px-4 py-4 text-sm font-semibold"><span>{row}</span><ArrowUpRight size={16} className="text-slate" /></div>)}</div> : <EmptyState title="Nothing connected yet" message={emptyText ?? "There is no data available for this section yet."} />}</section>; }

function ModalShell({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) { return <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/30 p-5 backdrop-blur-sm"><div className="modal-surface max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 sm:p-8"><div className="flex items-start justify-between"><div><h2 className="text-2xl font-bold tracking-tight">{title}</h2></div><button onClick={onClose} className="rounded-lg p-2 text-slate hover:bg-canvas"><X size={18} /></button></div>{children}</div></div>; }
function AuthModal({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: (profile: { name: string; email: string }) => void }) {
  const [stage, setStage] = useState<AuthStage>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaAnswer] = useState(() => String(Math.floor(Math.random() * 8) + 2));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const googleButton = useRef<HTMLDivElement>(null);
  const submitJson = async (url: string, body: unknown) => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as { error?: string; profile?: { name: string; email: string }; demoCode?: string };
    if (!response.ok) throw new Error(data.error || "The request failed.");
    return data;
  };
  const submitLogin = async () => {
    if (captcha !== captchaAnswer) return setError("CAPTCHA answer is incorrect.");
    setBusy(true); setError("");
    try { const data = await submitJson("/api/auth/login", { username, password }); if (data.profile) onSignedIn(data.profile); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Login failed."); } finally { setBusy(false); }
  };
  const register = async () => {
    if (captcha !== captchaAnswer) return setError("CAPTCHA answer is incorrect.");
    setBusy(true); setError("");
    try { const data = await submitJson("/api/auth/register", { username, password, email, displayName: name }); if (data.profile) onSignedIn(data.profile); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Registration failed."); } finally { setBusy(false); }
  };
  const handleGoogleCredential = async (credential: string) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const data = await submitJson("/api/auth/google/credential", { credential });
      if (data.profile) onSignedIn(data.profile);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Google sign-in failed.");
    } finally { setBusy(false); }
  };
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || !googleButton.current) return;
    const render = () => {
      if (!window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, ux_mode: "popup", callback: (response) => void handleGoogleCredential(response.credential) });
      googleButton.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButton.current, { theme: "outline", size: "large", width: 400, text: "signin_with" });
    };
    if (window.google) { render(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => { script.onload = null; };
  }, []);
  const title = stage === "login" ? "Log in to PlanOdyssey" : "Create your account";
  return <ModalShell title={title} onClose={onClose}><p className="mt-2 text-sm leading-6 text-slate">Use Google for secure one-click access, or continue with a local PlanOdyssey account.</p>{error && <p className="mt-4 rounded-xl bg-[#fff1ed] p-3 text-xs font-semibold text-[#c75d45]">{error}</p>}<div ref={googleButton} className="mt-6 flex min-h-10 justify-center" /><div className="my-5 flex items-center gap-3 text-xs font-semibold text-slate"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div><label className="block text-xs font-bold text-slate">Username<input autoFocus autoComplete="username" className="mt-2 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender" value={username} onChange={(e) => setUsername(e.target.value)} /></label>{stage === "register" && <><label className="mt-3 block text-xs font-bold text-slate">Display name<input className="mt-2 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender" value={name} onChange={(e) => setName(e.target.value)} /></label><label className="mt-3 block text-xs font-bold text-slate">Email<input type="email" className="mt-2 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender" value={email} onChange={(e) => setEmail(e.target.value)} /></label></>}<label className="mt-3 block text-xs font-bold text-slate">Password<input type="password" autoComplete={stage === "login" ? "current-password" : "new-password"} className="mt-2 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender" value={password} onChange={(e) => setPassword(e.target.value)} /></label><div className="mt-4 rounded-xl bg-canvas p-3"><p className="text-xs font-bold">CAPTCHA: What is 1 + {captchaAnswer}?</p><input className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm" inputMode="numeric" value={captcha} onChange={(e) => setCaptcha(e.target.value)} /></div><button disabled={busy} onClick={() => void (stage === "login" ? submitLogin() : register())} className="mt-5 w-full rounded-xl bg-ink py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Working..." : stage === "login" ? "Log in" : "Register"}</button><button disabled={busy} onClick={() => setStage(stage === "login" ? "register" : "login")} className="mt-3 w-full text-xs font-bold text-slate">{stage === "login" ? "New here? Register" : "Already have an account? Log in"}</button></ModalShell>;
}
function SubscriptionModal({ onClose, onPaid }: { onClose: () => void; onPaid: () => void }) { const [plan, setPlan] = useState("pro"); const [method, setMethod] = useState("UPI / QR"); const [seconds, setSeconds] = useState(180); useEffect(() => { const i = window.setInterval(() => setSeconds((s) => s > 0 ? s - 1 : 0), 1000); return () => window.clearInterval(i); }, []); const plans = [{ id: "free", name: "Free", price: "₹0", detail: "For trying the command center", items: ["1 active event", "50 guests", "Manual budget tracking", "Basic milestones", "Community support"] }, { id: "basic", name: "Basic", price: "₹499/mo", detail: "For personal celebrations", items: ["5 active events", "500 guests per event", "Gemini planning prompts", "Vendor quote comparison", "Google sign-in support"] }, { id: "pro", name: "Pro", price: "₹1,499/mo", detail: "For complex, high-touch events", items: ["Unlimited events and guests", "Location-aware AI research", "Scenario budget modelling", "Hotel and vendor brief generation", "Priority support and exports"] }]; return <ModalShell title="Choose your PlanOdyssey plan" onClose={onClose}><p className="mt-2 text-sm leading-6 text-slate">Compare every tier before you continue. Demo checkout below never charges a real card or UPI account.</p><div className="mt-6 space-y-3">{plans.map((item) => <button key={item.id} onClick={() => setPlan(item.id)} className={`w-full rounded-2xl border p-4 text-left ${plan === item.id ? "border-lavender bg-[#f5f3ff]" : "border-line"}`}><div className="flex items-center justify-between"><span className="font-bold">{item.name}</span><span className="font-bold text-lavender">{item.price}</span></div><p className="mt-1 text-xs text-slate">{item.detail}</p><ul className="mt-3 grid gap-1 text-xs text-slate sm:grid-cols-2">{item.items.map((feature) => <li key={feature}><Check size={12} className="mr-1 inline text-mint" />{feature}</li>)}</ul></button>)}</div>{plan !== "free" && <><div className="mt-6 grid grid-cols-2 gap-2">{["UPI / QR", "Card", "Net banking", "Wallet"].map((item) => <button key={item} onClick={() => setMethod(item)} className={`rounded-xl border px-3 py-3 text-xs font-bold ${method === item ? "border-lavender bg-[#efedff] text-lavender" : "border-line text-slate"}`}>{item}</button>)}</div>{method === "UPI / QR" && <div className="mx-auto mt-5 grid w-32 place-items-center rounded-2xl border-4 border-ink bg-white p-2"><div className="qr-pattern h-24 w-24" /><p className="mt-1 text-[9px] font-bold">planodyssey.demo</p></div>}<div className="mt-5 flex items-center justify-between text-xs font-bold text-slate"><span>Demo checkout expires</span><span className="text-peach">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span></div><button onClick={onPaid} disabled={seconds === 0} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-sm font-bold text-white disabled:opacity-40"><TicketCheck size={16} />Activate demo subscription</button></>}</ModalShell>; }
function CreatePlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: (plan: Partial<PlannerState>) => void }) {
  const [form, setForm] = useState({ eventName: "", eventType: "Wedding", eventDate: "", budget: "16000", confirmedGuests: "80", unsureGuests: "20", location: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ summary: string; budgetAdvice: string; recommendations: string[]; risks: string[]; categories: { label: string; amount: number }[]; milestones: { title: string; date: string; description: string }[]; completionWish: string } | null>(null);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, budget: Number(form.budget), confirmedGuests: Number(form.confirmedGuests), unsureGuests: Number(form.unsureGuests) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create the plan.");
      setResult(data.plan);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create the plan.");
    } finally { setLoading(false); }
  };
  if (result) return <ModalShell title="Your AI plan is ready" onClose={onClose}><div className="mt-5 rounded-2xl bg-[#efedff] p-4 text-sm leading-6 text-ink"><Sparkles size={17} className="mb-2 text-lavender" />{result.summary}</div><p className="mt-5 text-sm font-bold">Money strategy</p><p className="mt-2 text-sm leading-6 text-slate">{result.budgetAdvice}</p><p className="mt-5 text-sm font-bold">Suggested allocation</p><ul className="mt-2 space-y-2 text-sm text-slate">{result.categories.map((item) => <li key={item.label} className="flex justify-between gap-4"><span>{item.label}</span><strong>{formatCurrency(item.amount)}</strong></li>)}</ul><p className="mt-5 text-sm font-bold">Your event timeline</p>{result.milestones.length ? <ul className="mt-2 space-y-2 text-sm leading-6 text-slate">{result.milestones.map((item) => <li key={`${item.title}-${item.date}`}><CalendarDays size={14} className="mr-2 inline text-lavender" /><strong>{item.date}:</strong> {item.title}</li>)}</ul> : <p className="mt-2 text-sm text-slate">No milestone data was returned; a standard date-based timeline will be generated.</p>}<p className="mt-5 text-sm font-bold">Location recommendations</p>{result.recommendations.length ? <ul className="mt-2 space-y-2 text-sm leading-6 text-slate">{result.recommendations.map((item) => <li key={item}><Check size={14} className="mr-2 inline text-mint" />{item}</li>)}</ul> : <p className="mt-2 text-sm text-slate">No location recommendations were returned.</p>}{result.risks?.length > 0 && <><p className="mt-5 text-sm font-bold text-[#c75d45]">Date and location risks to verify</p><ul className="mt-2 space-y-2 text-sm leading-6 text-[#c75d45]">{result.risks.map((item) => <li key={item}>• {item}</li>)}</ul></>}<button onClick={() => onCreated({ eventName: form.eventName, eventType: form.eventType, eventDate: form.eventDate, location: form.location, budget: Number(form.budget), guests: Number(form.confirmedGuests) + Number(form.unsureGuests), planValidated: true, planRisks: result.risks, completionWish: result.completionWish, milestones: result.milestones.length ? result.milestones.map((item, index): Milestone => ({ id: `ai-milestone-${index}`, title: item.title, date: item.date, description: item.description, status: index === 0 ? "active" : "upcoming" })) : undefined, categories: result.categories.map((item, index): BudgetCategory => ({ id: `ai-${index}`, label: item.label, amount: Math.round(item.amount), color: ["#7567f8", "#42b89a", "#ff9b75", "#efc15c", "#70a7ec"][index % 5], icon: ["building", "utensils", "sparkles", "camera", "music"][index % 5] })) })} className="mt-6 w-full rounded-xl bg-ink py-3 text-sm font-bold text-white">Validate plan and start countdown</button></ModalShell>;
  return <ModalShell title="Create a new event plan" onClose={onClose}><p className="mt-2 text-sm leading-6 text-slate">Odyssey will turn your date, place, guest uncertainty, and budget into a location-aware plan focused on protecting your money.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate sm:col-span-2">Event name<input className="mt-2 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender" value={form.eventName} onChange={(e) => update("eventName", e.target.value)} placeholder="Maya's Jaipur wedding" /></label><label className="text-xs font-bold text-slate">Event type<select className="mt-2 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender" value={form.eventType} onChange={(e) => update("eventType", e.target.value)}><option>Wedding</option><option>Birthday</option><option>Community</option><option>Corporate</option><option>Other</option></select></label><label className="text-xs font-bold text-slate">Event date<input type="date" className="mt-2 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender" value={form.eventDate} onChange={(e) => update("eventDate", e.target.value)} /></label><label className="text-xs font-bold text-slate">Budget<input type="number" min="1000" className="mt-2 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender" value={form.budget} onChange={(e) => update("budget", e.target.value)} /></label><label className="text-xs font-bold text-slate">Confirmed guests<input type="number" min="0" className="mt-2 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender" value={form.confirmedGuests} onChange={(e) => update("confirmedGuests", e.target.value)} /></label><label className="text-xs font-bold text-slate">Not sure guests<input type="number" min="0" className="mt-2 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender" value={form.unsureGuests} onChange={(e) => update("unsureGuests", e.target.value)} /></label><label className="text-xs font-bold text-slate sm:col-span-2">Place / city<input className="mt-2 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Jaipur, Rajasthan" /></label></div>{error && <p className="mt-4 rounded-xl bg-[#fff1ed] p-3 text-xs font-semibold text-[#c75d45]">{error}</p>}<button onClick={submit} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? "Odyssey is researching..." : <><Sparkles size={16} />Generate AI plan</>}</button></ModalShell>;
}

function ChatModal({ onClose, onPaywall }: { onClose: () => void; onPaywall: () => void }) {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>>([]);
  const [messages, setMessages] = useState<Array<{ text: string; type: "user" | "bot" | "error" }>>([
    { text: "New conversation started. What would you like to ask?", type: "bot" }
  ]);
  const [busy, setBusy] = useState(false);

  const sendMessage = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    const nextHistory = [...history, { role: "user" as const, parts: [{ text: prompt }] }];
    setHistory(nextHistory);
    setMessages((current) => [...current, { text: prompt, type: "user" }, { text: "Gemini is thinking...", type: "bot" }]);
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, history })
      });
      const data = await response.json() as { error?: string; answer?: string };
      if (!response.ok) throw new Error(data.error || `API request failed (${response.status})`);
      const answer = data.answer?.trim();
      if (!answer) throw new Error("Gemini returned no text. Try another message.");
      setMessages((current) => [...current.slice(0, -1), { text: answer, type: "bot" }]);
      setHistory([...nextHistory, { role: "model", parts: [{ text: answer }] }]);
    } catch (error) {
      setHistory(history);
      setMessages((current) => [...current.slice(0, -1), { text: `Error: ${error instanceof Error ? error.message : "Gemini request failed."}`, type: "error" }]);
    } finally {
      setBusy(false);
    }
  };

  const clearChat = () => {
    if (busy) return;
    setHistory([]);
    setMessages([{ text: "New conversation started. What would you like to ask?", type: "bot" }]);
  };

  return <ModalShell title="Odyssey AI concierge" onClose={onClose}>
    <p className="mt-2 text-sm leading-6 text-slate">Powered by the Gemini API configured for PlanOdyssey. Odyssey specializes in complex event money management, budget tradeoffs, vendor comparisons, guest-driven cost changes, and date/location risk checks.</p>
    <div className="mt-5 h-64 space-y-3 overflow-y-auto rounded-2xl bg-canvas p-4">
      {messages.map((item, index) => <div key={`${index}-${item.text.slice(0, 12)}`} className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${item.type === "user" ? "ml-auto bg-ink text-white" : item.type === "error" ? "bg-[#fff1ed] text-[#c75d45]" : "bg-white text-ink shadow-card"}`}>{item.text}</div>)}
    </div>
    <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void sendMessage(message); }}>
      <textarea autoFocus disabled={busy} className="min-h-20 w-full rounded-xl border border-line px-3 py-3 outline-none focus:border-lavender disabled:opacity-60" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Hi Odyssey, what is 18 × 24?" />
      <div className="mt-3 flex gap-3"><button type="button" onClick={clearChat} disabled={busy} className="flex-1 rounded-xl border border-line py-3 text-xs font-bold text-slate disabled:opacity-50">Clear chat</button><button type="button" onClick={onPaywall} className="flex-1 rounded-xl border border-line py-3 text-xs font-bold text-slate">Compare plans</button><button type="submit" disabled={busy || !message.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Thinking..." : <><Send size={15} />Send</>}</button></div>
    </form>
  </ModalShell>;
}
function SettingsModal({ theme, setTheme, onClose, onLogout }: { theme: "light" | "dim"; setTheme: (t: "light" | "dim") => void; onClose: () => void; onLogout: () => void }) { return <ModalShell title="Settings" onClose={onClose}><div className="mt-6 space-y-3"><div className="flex items-center justify-between rounded-2xl border border-line p-4"><div className="flex items-center gap-3"><Sun size={18} className="text-lavender" /><div><p className="text-sm font-bold">Appearance</p><p className="text-xs text-slate">Choose your workspace tone</p></div></div><select value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dim")} className="rounded-lg border border-line p-2 text-xs font-bold"><option value="light">Light</option><option value="dim">Dim</option></select></div><div className="flex items-center justify-between rounded-2xl border border-line p-4"><div className="flex items-center gap-3"><Bell size={18} className="text-lavender" /><div><p className="text-sm font-bold">Planning reminders</p><p className="text-xs text-slate">Weekly runway nudges</p></div></div><input type="checkbox" defaultChecked className="h-4 w-4 accent-[#7567f8]" /></div><button onClick={onLogout} className="flex w-full items-center gap-3 rounded-2xl border border-[#ffdcd4] p-4 text-left text-sm font-bold text-[#c75d45]"><LogOut size={18} />Sign out of this workspace</button></div></ModalShell>; }
function ProfileModal({ profile, signedIn, onClose, onSignIn }: { profile: { name: string; email: string }; signedIn: boolean; onClose: () => void; onSignIn: () => void }) { return <ModalShell title="Your profile" onClose={onClose}><div className="mt-6 flex items-center gap-4 rounded-2xl bg-canvas p-4"><div className="grid h-14 w-14 place-items-center rounded-full bg-[#f3d6c8] text-lg font-bold text-[#825945]">{profile.name.slice(0, 2).toUpperCase()}</div><div><p className="font-bold">{profile.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate"><Mail size={12} />{profile.email}</p></div></div>{signedIn ? <div className="mt-5 rounded-xl bg-[#e6f7f2] p-3 text-xs font-semibold text-mint"><Check size={14} className="mr-1 inline" />Your Google or local profile is synced.</div> : <button onClick={onSignIn} className="mt-5 w-full rounded-xl bg-ink py-3 text-sm font-bold text-white">Sign in or register</button>}</ModalShell>; }
function FeedbackModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) { const [text, setText] = useState(""); return <ModalShell title="Feedback & improvements" onClose={onClose}><p className="mt-2 text-sm leading-6 text-slate">Tell the product team what would make planning calmer or more powerful.</p><textarea className="mt-6 min-h-32 w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-lavender" value={text} onChange={(e) => setText(e.target.value)} placeholder="I would love to..." /><button onClick={onDone} disabled={!text.trim()} className="mt-4 w-full rounded-xl bg-ink py-3 text-sm font-bold text-white disabled:opacity-40">Submit feedback</button></ModalShell>; }
function HelpModal({ onClose }: { onClose: () => void }) { return <ModalShell title="Contact PlanOdyssey" onClose={onClose}><p className="mt-2 text-sm leading-6 text-slate">We are here for setup, vendor questions, and partnership feedback.</p><div className="mt-6 space-y-3"><a href="mailto:hello@planodyssey.app" className="flex items-center gap-3 rounded-2xl border border-line p-4 text-sm font-bold"><Mail size={18} className="text-lavender" />hello@planodyssey.app</a><a href="tel:+911800123456" className="flex items-center gap-3 rounded-2xl border border-line p-4 text-sm font-bold"><Phone size={18} className="text-lavender" />+91 1800 123 456</a><div className="flex items-center gap-3 rounded-2xl border border-line p-4 text-sm font-bold"><Globe2 size={18} className="text-lavender" />Mon–Fri · 10:00–18:00 IST</div></div></ModalShell>; }
