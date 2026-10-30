"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, Bell, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, Command, Copy, CreditCard, Download,
  FileText, Globe2, Heart, Home, Images, IndianRupee, ListChecks, LogOut, Mail, MapPin, Menu, MessageCircle, Moon,
  MoreHorizontal, Phone, Plus, Printer, RotateCcw, Search, Send, Settings2, Share2, Sparkles, Star, Sun,
  TicketCheck, Trash2, TrendingUp, Upload, UserRound, Users, X
} from "lucide-react";
import { buildPlanMilestones, formatCurrency, getBudgetAnalytics, getBudgetHealth, INITIAL_STATE } from "@/lib/planner-engine";
import type { BudgetCategory, Currency, Milestone, PlannerState } from "@/lib/types";

/* ───────────────────────────── Types ───────────────────────────── */
type View = "Overview" | "Budget" | "Guests" | "Vendors" | "Timeline" | "Checklist" | "Documents" | "Inspiration";
type Modal = "auth" | "subscription" | "chat" | "create-plan" | "settings" | "profile" | "feedback" | "help" | "share" | null;
type AuthStage = "login" | "register";
type Rsvp = "confirmed" | "pending" | "declined";
type Vendor = PlannerState["vendors"][number];
type VStatus = "shortlisted" | "requested" | "booked";
type Guest = { id: string; name: string; group: string; meal: string; rsvp: Rsvp; plusOnes: number };
type Task = { id: string; title: string; due: string; done: boolean };
type Doc = { id: string; name: string; kind: string; size: string; added: string };
type Expense = { id: string; label: string; categoryId: string; amount: number; date: string };
type Photo = { id: string; title: string; tag: string; src: string };
type Extras = {
  guests: Guest[]; tasks: Task[]; docs: Doc[]; expenses: Expense[]; done: Record<string, boolean>;
  vstatus: Record<string, VStatus>; customVendors: Vendor[]; pins: string[]; theme: "light" | "dark"; alertsRead: boolean;
};
type Analytics = ReturnType<typeof getBudgetAnalytics>;
type GoogleCredentialResponse = { credential: string };
type GoogleAccounts = { id: { initialize: (options: { client_id: string; ux_mode: "popup"; callback: (response: GoogleCredentialResponse) => void }) => void; renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number; text: string }) => void } };
declare global { interface Window { google?: { accounts: GoogleAccounts } } }

/* ───────────────────────────── Constants ───────────────────────────── */
const PLAN_KEY = "planodyssey.current-plan";
const EXTRAS_KEY = "planodyssey.extras.v1";
const u = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
const HERO_BY_TYPE: Record<string, string> = {
  Wedding: "1519225421980-715cb0215aed", Birthday: "1464366400600-7168b8af9bc3", Corporate: "1478146896981-b80fe463b330",
  Community: "1469371670807-013ccf25f16a", Other: "1492684223066-81342ee5ff30"
};
const PHOTOS: Photo[] = [
  { id: "p1", title: "Fairy-light courtyard", tag: "Decor", src: u("1519225421980-715cb0215aed") },
  { id: "p2", title: "Long banquet table", tag: "Decor", src: u("1511795409834-ef04bbd61622") },
  { id: "p3", title: "Garden ceremony", tag: "Venue", src: u("1519741497674-611481863552") },
  { id: "p4", title: "Gala dinner glow", tag: "Venue", src: u("1478146896981-b80fe463b330") },
  { id: "p5", title: "Floral centrepieces", tag: "Decor", src: u("1505236858219-8359eb29e329") },
  { id: "p6", title: "Celebration confetti", tag: "Party", src: u("1492684223066-81342ee5ff30") },
  { id: "p7", title: "Festival lighting", tag: "Party", src: u("1469371670807-013ccf25f16a") },
  { id: "p8", title: "Plated tasting menu", tag: "Food", src: u("1555244162-803834f70033") },
  { id: "p9", title: "Dance-floor night", tag: "Party", src: u("1464366400600-7168b8af9bc3") }
];
const NAV: { label: View; icon: typeof Home }[] = [
  { label: "Overview", icon: Home }, { label: "Budget", icon: IndianRupee }, { label: "Guests", icon: Users },
  { label: "Vendors", icon: Sparkles }, { label: "Timeline", icon: CalendarDays }, { label: "Checklist", icon: ListChecks },
  { label: "Documents", icon: FileText }, { label: "Inspiration", icon: Images }
];
const UTILITY: { label: string; icon: typeof Home; modal: Modal }[] = [
  { label: "AI concierge", icon: MessageCircle, modal: "chat" },
  { label: "Plans & subscription", icon: CreditCard, modal: "subscription" },
  { label: "Feedback & improvements", icon: TrendingUp, modal: "feedback" },
  { label: "Contact us", icon: Phone, modal: "help" }
];
const DEFAULT_EXTRAS: Extras = {
  guests: [], docs: [], expenses: [], done: {}, vstatus: {}, customVendors: [], pins: ["p1", "p5"], theme: "light", alertsRead: false,
  tasks: [
    { id: "t1", title: "Lock the venue and pay the booking advance", due: "", done: false },
    { id: "t2", title: "Send save-the-date messages", due: "", done: false },
    { id: "t3", title: "Shortlist three caterers and taste-test", due: "", done: false },
    { id: "t4", title: "Confirm photographer and music", due: "", done: false },
    { id: "t5", title: "Finalise run-of-show with family", due: "", done: false }
  ]
};
const SAMPLE_GUESTS: Guest[] = [
  { id: "g1", name: "Aarav Mehta", group: "Family", meal: "Vegetarian", rsvp: "confirmed", plusOnes: 1 },
  { id: "g2", name: "Ishita Sharma", group: "Friends", meal: "Vegetarian", rsvp: "confirmed", plusOnes: 0 },
  { id: "g3", name: "Rohan Kapoor", group: "Work", meal: "Non-vegetarian", rsvp: "pending", plusOnes: 1 },
  { id: "g4", name: "Meera Joshi", group: "Family", meal: "Jain", rsvp: "confirmed", plusOnes: 2 },
  { id: "g5", name: "Kabir Singh", group: "Friends", meal: "Non-vegetarian", rsvp: "declined", plusOnes: 0 },
  { id: "g6", name: "Anaya Verma", group: "Work", meal: "Vegan", rsvp: "pending", plusOnes: 0 }
];
const QUICK_PROMPTS = ["How can I cut 10% from my budget?", "What should I confirm first with caterers?", "Which costs rise most if guests grow?", "Create a 2-week countdown checklist"];
const RSVP_NEXT: Record<Rsvp, Rsvp> = { pending: "confirmed", confirmed: "declined", declined: "pending" };

/* ───────────────────────────── Helpers ───────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtDate = (d: string) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); };
const initials = (name: string) => name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "PO";
const sizeLabel = (bytes: number) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const today = () => new Date().toISOString().slice(0, 10);

/* Milestone dates must sit between today and the event. AI output often ignores today's date,
   so if any date is invalid, out of order, in the past or after the event, re-space them evenly. */
const DAY = 86400000;
const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);
function fixMilestones<T extends { date: string }>(items: T[], eventDate: string): T[] {
  const event = Date.parse(eventDate);
  const now = new Date();
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (!items.length || Number.isNaN(event) || event <= start) return items;
  const times = items.map((m) => Date.parse(m.date));
  const ok = times.every((t, i) => !Number.isNaN(t) && t >= start && t <= event && (i === 0 || t >= times[i - 1]));
  if (ok) return items;
  const days = Math.round((event - start) / DAY);
  const span = Math.max(days - 2, 1);
  return items.map((m, i) => ({ ...m, date: isoOf(start + Math.min(days, Math.max(0, Math.round(span * (i + 1) / items.length))) * DAY) }));
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readStoredPlan(): PlannerState {
  try {
    const stored = window.localStorage.getItem(PLAN_KEY);
    if (!stored) return INITIAL_STATE;
    const parsed = JSON.parse(stored) as Partial<PlannerState>;
    return parsed.eventName && Array.isArray(parsed.categories)
      ? { ...INITIAL_STATE, ...parsed, milestones: buildPlanMilestones(parsed.eventDate || INITIAL_STATE.eventDate, parsed.eventType || INITIAL_STATE.eventType) }
      : INITIAL_STATE;
  } catch { return INITIAL_STATE; }
}

/* ───────────────────────────── Small shared UI ───────────────────────────── */
function Photo({ src, alt, className = "", caption }: { src: string; alt: string; className?: string; caption?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`tile ${className}`}>
      {!broken && /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />}
      {caption && <div className="cap">{caption}</div>}
    </div>
  );
}
function Empty({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return <div className="empty"><p className="text-sm font-bold">{title}</p><p className="muted mx-auto mt-2 max-w-sm text-xs leading-5">{message}</p>{action && <div className="mt-4 flex justify-center gap-2">{action}</div>}</div>;
}
function SectionHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="display text-4xl leading-tight sm:text-[44px]">{title}</h1>{sub && <p className="muted mt-2 text-sm">{sub}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>;
}
function ModalShell({ children, title, onClose, wide = false, sub }: { children: React.ReactNode; title: string; onClose: () => void; wide?: boolean; sub?: string }) {
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide ? "modal-wide" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="display text-3xl leading-tight">{title}</h2>{sub && <p className="muted mt-2 text-sm leading-6">{sub}</p>}</div>
          <button className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Close dialog"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────────── Countdown ───────────────────────────── */
function Countdown({ state, onValidate }: { state: PlannerState; onValidate: () => void }) {
  const calc = useCallback(() => Math.max(0, new Date(state.eventDate).getTime() - Date.now()), [state.eventDate]);
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => { setMs(calc()); const t = window.setInterval(() => setMs(calc()), 1000); return () => window.clearInterval(t); }, [calc]);
  if (ms === null) return null;
  const s = Math.floor(ms / 1000);
  const parts: [number, string][] = [[Math.floor(s / 86400), "days"], [Math.floor((s % 86400) / 3600), "hours"], [Math.floor((s % 3600) / 60), "min"], [s % 60, "sec"]];
  if (!state.planValidated) return <div className="glass max-w-[300px] p-5"><p className="text-sm font-semibold leading-6">Validate your plan to start the live countdown.</p><button onClick={onValidate} className="btn btn-gold btn-sm mt-3">Validate plan</button></div>;
  if (ms === 0) return <div className="glass max-w-[320px] p-5"><Sparkles size={18} className="mb-2 text-[#f3b44f]" /><p className="text-sm font-semibold leading-6">{state.completionWish || "Wishing you a beautiful celebration filled with wonderful memories!"}</p></div>;
  return <div className="flex gap-2">{parts.map(([v, l]) => <div key={l} className="glass min-w-[64px] px-2 py-3 text-center"><p className="display tnum text-3xl leading-none">{String(v).padStart(2, "0")}</p><p className="mt-1 text-[11px] text-white/70">{l}</p></div>)}</div>;
}

/* ───────────────────────────── Dashboard ───────────────────────────── */
export default function Dashboard() {
  const [state, setState] = useState<PlannerState>(INITIAL_STATE);
  const [lastValidatedPlan, setLastValidatedPlan] = useState<PlannerState>(INITIAL_STATE);
  const [previousValidatedPlan, setPreviousValidatedPlan] = useState<PlannerState | null>(null);
  const [extras, setExtras] = useState<Extras>(DEFAULT_EXTRAS);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("Overview");
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [introOn, setIntroOn] = useState(true);
  const [introLeaving, setIntroLeaving] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [toast, setToast] = useState("");
  const [profile, setProfile] = useState({ name: "Priyanshu Raiya", email: "priyanshu@example.com" });
  const toastTimer = useRef<number | undefined>(undefined);

  const health = useMemo(() => getBudgetHealth(state), [state]);
  const analytics = useMemo(() => getBudgetAnalytics(state, previousValidatedPlan), [state, previousValidatedPlan]);
  const isDirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(lastValidatedPlan), [state, lastValidatedPlan]);
  const patch = (p: Partial<Extras>) => setExtras((c) => ({ ...c, ...p }));
  const notify = useCallback((message: string) => { setToast(message); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(""), 3200); }, []);

  /* hydrate saved data after mount (avoids SSR mismatch) */
  useEffect(() => {
    const plan = readStoredPlan();
    setState(plan);
    setLastValidatedPlan(plan.validation?.status === "valid" || plan.validation?.status === "warning" ? plan : INITIAL_STATE);
    try { const raw = window.localStorage.getItem(EXTRAS_KEY); if (raw) setExtras({ ...DEFAULT_EXTRAS, ...(JSON.parse(raw) as Partial<Extras>) }); } catch { /* ignore corrupt data */ }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) try { window.localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras)); } catch { /* storage full */ } }, [extras, hydrated]);

  /* opening sequence */
  const endIntro = useCallback(() => { setIntroLeaving(true); window.setTimeout(() => setIntroOn(false), 950); }, []);
  useEffect(() => { const t = window.setTimeout(endIntro, 2600); return () => window.clearTimeout(t); }, [endIntro]);

  /* session */
  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("authError");
    if (authError) notify(authError);
    void fetch("/api/auth/session").then((r) => r.json()).then((d: { signedIn?: boolean; profile?: { name: string; email: string } }) => { if (d.signedIn && d.profile) { setSignedIn(true); setProfile(d.profile); } }).catch(() => undefined);
  }, [notify]);

  /* shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
      if (e.key === "Escape") { setPalette(false); setAlertsOpen(false); setLightbox(null); setModal(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* plan editing */
  const draft = { planValidated: false, validation: { status: "draft" as const, message: "Unsaved changes." } };
  const updateNumber = (key: "budget" | "guests", value: string) => { const n = Number(value); if (value === "" || Number.isFinite(n)) setState((c) => ({ ...c, [key]: value === "" ? 0 : n, ...draft })); };
  const updateCategory = (id: string, value: string) => { const n = Number(value); if (value === "" || Number.isFinite(n)) setState((c) => ({ ...c, categories: c.categories.map((k) => k.id === id ? { ...k, amount: value === "" ? 0 : n } : k), ...draft })); };
  const updateCurrency = (value: string) => { if (value === "INR" || value === "USD") setState((c) => ({ ...c, currency: value as Currency, ...draft })); };
  const validatePlan = (candidate: PlannerState = state) => {
    const errors: string[] = [];
    if (!candidate.eventName.trim() || !candidate.eventDate || !candidate.location.trim()) errors.push("Event name, date, and location are required.");
    if (!Number.isFinite(candidate.budget) || candidate.budget <= 0) errors.push("Total budget must be greater than zero.");
    if (!Number.isFinite(candidate.guests) || candidate.guests <= 0) errors.push("Guest count must be greater than zero.");
    if (candidate.categories.some((k) => !Number.isFinite(k.amount) || k.amount < 0)) errors.push("Allocations cannot be negative or invalid.");
    if (errors.length) { setState({ ...candidate, planValidated: false, validation: { status: "invalid" as const, message: errors.join(" ") } }); notify("Fix the highlighted plan fields before validating."); return; }
    const overage = candidate.categories.reduce((s, k) => s + k.amount, 0) - candidate.budget;
    const status = overage > 0 ? "warning" as const : "valid" as const;
    const message = overage > 0 ? `${formatCurrency(overage, candidate.currency)} over budget. The plan is validated with a warning.` : `${formatCurrency(-overage, candidate.currency)} remains unallocated.`;
    const validated = { ...candidate, planValidated: true, validation: { status, message, validatedAt: new Date().toISOString() } };
    setPreviousValidatedPlan(lastValidatedPlan); setLastValidatedPlan(validated); setState(validated);
    window.localStorage.setItem(PLAN_KEY, JSON.stringify(validated));
    notify(overage > 0 ? "Plan validated with an overspending warning." : "Plan validated and analytics refreshed.");
  };
  const restorePlan = () => { setState(lastValidatedPlan); notify("Restored the previous validated plan."); };
  const saveDraft = () => { window.localStorage.setItem(PLAN_KEY, JSON.stringify(state)); notify("Draft saved on this device. Validate it to confirm the plan."); };
  const applyGeneratedPlan = (plan: Partial<PlannerState>) => {
    const next = { ...state, spent: 0, ...plan };
    if (!plan.milestones) next.milestones = buildPlanMilestones(next.eventDate, next.eventType);
    setExtras((c) => ({ ...c, done: {} })); setState(next); validatePlan(next);
  };

  /* derived */
  const milestones = fixMilestones(state.milestones, state.eventDate).map((m) => ({ ...m, status: extras.done[m.id] ? "complete" as const : m.status }));
  const vendors: Vendor[] = [...state.vendors, ...extras.customVendors];
  const confirmed = extras.guests.filter((g) => g.rsvp === "confirmed");
  const headcount = confirmed.reduce((s, g) => s + 1 + g.plusOnes, 0);
  const pendingCount = extras.guests.filter((g) => g.rsvp === "pending").length;
  const tasksDone = extras.tasks.filter((t) => t.done).length;
  const spent = extras.expenses.reduce((s, e) => s + e.amount, 0);
  const nextMilestone = milestones.find((m) => m.status !== "complete");
  const alerts = useMemo(() => {
    const a: { id: string; tone: "rose" | "gold" | "teal"; title: string; body: string }[] = [];
    if (analytics.status === "over") a.push({ id: "over", tone: "rose", title: "Over budget", body: `Allocations exceed your budget by ${formatCurrency(Math.abs(analytics.remaining), state.currency)}.` });
    if (!state.planValidated) a.push({ id: "validate", tone: "gold", title: "Plan not validated", body: "Validate your plan to confirm numbers and start the countdown." });
    if (spent > 0 && spent > state.budget) a.push({ id: "spent", tone: "rose", title: "Logged spend passes your budget", body: `${formatCurrency(spent, state.currency)} logged against ${formatCurrency(state.budget, state.currency)}.` });
    if (pendingCount) a.push({ id: "rsvp", tone: "gold", title: `${pendingCount} RSVP${pendingCount > 1 ? "s" : ""} pending`, body: "Send a reminder from the Guests section." });
    if (nextMilestone) a.push({ id: "next", tone: "teal", title: "Next milestone", body: `${nextMilestone.title} · ${nextMilestone.date}` });
    return a;
  }, [analytics.status, analytics.remaining, state.currency, state.planValidated, state.budget, spent, pendingCount, nextMilestone]);

  /* exports */
  const briefText = () => [
    `${state.eventName}`, `${fmtDate(state.eventDate)} · ${state.location}`, "",
    `Budget: ${formatCurrency(state.budget, state.currency)} | Allocated: ${formatCurrency(analytics.allocated, state.currency)} | Remaining: ${formatCurrency(analytics.remaining, state.currency)}`,
    `Guests planned: ${state.guests} | Confirmed headcount: ${headcount}`, "", "Allocation",
    ...analytics.categoryBreakdown.map((c) => `- ${c.label}: ${formatCurrency(c.amount, state.currency)} (${Math.round(c.percentage)}%)`), "", "Timeline",
    ...milestones.map((m) => `- [${m.status === "complete" ? "x" : " "}] ${m.date} ${m.title}`), "", "Checklist",
    ...extras.tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.title}`)
  ].join("\n");
  const exportPlan = () => { download(`${state.eventName.replace(/\W+/g, "-").toLowerCase() || "plan"}.json`, JSON.stringify({ plan: state, ...extras }, null, 2), "application/json"); notify("Plan downloaded as JSON."); };
  const exportBrief = () => { download("event-brief.txt", briefText(), "text/plain"); notify("Event brief downloaded."); };

  const go = (v: View) => { setView(v); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const toggleTheme = () => patch({ theme: extras.theme === "light" ? "dark" : "light" });

  const commands: { label: string; hint: string; icon: typeof Home; run: () => void }[] = [
    ...NAV.map((n) => ({ label: `Go to ${n.label}`, hint: "Navigate", icon: n.icon, run: () => go(n.label) })),
    { label: "Create a new plan", hint: "Action", icon: Plus, run: () => setModal("create-plan") },
    { label: "Ask Odyssey", hint: "Action", icon: Sparkles, run: () => setModal("chat") },
    { label: "Validate plan", hint: "Action", icon: Check, run: () => validatePlan() },
    { label: extras.theme === "light" ? "Switch to dark theme" : "Switch to light theme", hint: "Appearance", icon: Moon, run: toggleTheme },
    { label: "Share or export plan", hint: "Action", icon: Share2, run: () => setModal("share") },
    { label: "Compare subscription plans", hint: "Account", icon: CreditCard, run: () => setModal("subscription") }
  ];

  return (
    <main className="app relative min-h-screen overflow-x-hidden" data-theme={extras.theme}>
      {introOn && (
        <div className={`intro ${introLeaving ? "leaving" : ""}`} aria-hidden={introLeaving}>
          <div className="intro-bg" style={{ backgroundImage: `url(${u("1519225421980-715cb0215aed", 1800)})` }} />
          <div className="intro-inner">
            <div className="intro-mark"><Command size={28} /></div>
            <h1 className="intro-word display" aria-label="PlanOdyssey">{"PlanOdyssey".split("").map((c, i) => <span key={i} style={{ "--i": i } as React.CSSProperties}>{c}</span>)}</h1>
            <p className="intro-tag">Your celebration, intelligently orchestrated.</p>
            <div className="intro-bar"><i /></div>
          </div>
          <button className="intro-skip" onClick={endIntro}>Skip intro</button>
        </div>
      )}

      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar */}
        <aside className={`sidebar no-print fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col px-4 py-6 transition-transform duration-300 lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="mb-8 flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl text-[#2a1b04]" style={{ background: "linear-gradient(180deg,#f3b44f,#e39a2a)" }}><Command size={19} /></div>
              <div><p className="display text-xl leading-none text-white">PlanOdyssey</p><p className="mt-1 text-[11px] text-white/50">Event command center</p></div>
            </div>
            <button className="icon-btn icon-btn-sm lg:hidden" style={{ background: "transparent", borderColor: "rgba(255,255,255,.2)", color: "#fff" }} onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={16} /></button>
          </div>
          <nav className="space-y-1" aria-label="Workspace">
            {NAV.map(({ label, icon: Icon }) => (
              <button key={label} onClick={() => go(label)} className={`nav-item ${view === label ? "active" : ""}`} aria-current={view === label ? "page" : undefined}>
                <Icon size={18} />{label}
                {label === "Vendors" && <span className="nav-count">{vendors.length}</span>}
                {label === "Guests" && extras.guests.length > 0 && <span className="nav-count">{extras.guests.length}</span>}
                {label === "Checklist" && <span className="nav-count">{tasksDone}/{extras.tasks.length}</span>}
              </button>
            ))}
          </nav>
          <div className="mt-7 space-y-1 border-t border-white/10 pt-5">
            {UTILITY.map(({ label, icon: Icon, modal: target }) => <button key={label} onClick={() => { setModal(target); setMobileNav(false); }} className="nav-item"><Icon size={18} />{label}</button>)}
          </div>
          <div className="mt-auto space-y-1">
            <button onClick={toggleTheme} className="nav-item">{extras.theme === "light" ? <Moon size={18} /> : <Sun size={18} />}{extras.theme === "light" ? "Dark theme" : "Light theme"}</button>
            <button onClick={() => setModal("settings")} className="nav-item"><Settings2 size={18} />Settings</button>
            <button onClick={() => setModal("profile")} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-white hover:bg-white/10">
              <div className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-[#2a1b04]" style={{ background: "#f3b44f" }}>{initials(profile.name)}</div>
              <div className="min-w-0"><p className="truncate text-sm font-bold">{profile.name}</p><p className="text-xs text-white/55">{signedIn ? "Verified profile" : "Guest profile"}</p></div>
              <MoreHorizontal size={17} className="ml-auto text-white/50" />
            </button>
          </div>
        </aside>
        {mobileNav && <button aria-label="Close menu overlay" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileNav(false)} />}

        {/* Content */}
        <section className="min-w-0 flex-1 px-4 pb-16 pt-3 sm:px-8 lg:px-10">
          <header className="topbar no-print mb-8 flex items-center gap-3">
            <button className="icon-btn lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={19} /></button>
            <button className="search-fake" onClick={() => setPalette(true)} aria-label="Search and run commands"><Search size={16} /><span className="truncate">Search or jump to anything</span><kbd className="hidden sm:inline">Ctrl K</kbd></button>
            <div className="ml-auto flex items-center gap-2">
              <button className="icon-btn hidden sm:grid" onClick={toggleTheme} aria-label="Toggle theme">{extras.theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button>
              <button className="icon-btn" onClick={() => { setAlertsOpen(true); patch({ alertsRead: true }); }} aria-label="View plan alerts"><Bell size={17} />{!extras.alertsRead && alerts.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full" style={{ background: "var(--rose)" }} />}</button>
              <button className="btn btn-sm hidden sm:inline-flex" onClick={() => setModal("share")}><Share2 size={15} />Share</button>
              {signedIn
                ? <button onClick={() => setModal("profile")} className="btn btn-sm"><span className="grid h-6 w-6 place-items-center rounded-full text-[10px] text-[#2a1b04]" style={{ background: "#f3b44f" }}>{initials(profile.name)}</span><span className="hidden sm:inline">{profile.name.split(" ")[0]}</span></button>
                : <button onClick={() => setModal("auth")} className="btn btn-sm"><UserRound size={15} />Sign in</button>}
              <button onClick={() => setModal("chat")} className="btn btn-primary btn-sm"><Sparkles size={15} />Ask Odyssey</button>
            </div>
          </header>

          <div key={view} className="view">
            {view === "Overview" && <Overview state={state} analytics={analytics} isDirty={isDirty} extras={extras} headcount={headcount} milestones={milestones} vendors={vendors} spent={spent} tasksDone={tasksDone} nextMilestone={nextMilestone} onValidate={() => validatePlan()} onRestore={restorePlan} go={go} setModal={setModal} toggleMilestone={(id) => patch({ done: { ...extras.done, [id]: !extras.done[id] } })} setLightbox={setLightbox} onExport={exportBrief} />}
            {view === "Budget" && <BudgetView state={state} analytics={analytics} health={health} isDirty={isDirty} extras={extras} patch={patch} onValidate={() => validatePlan()} onRestore={restorePlan} onSave={saveDraft} updateNumber={updateNumber} updateCategory={updateCategory} updateCurrency={updateCurrency} notify={notify} />}
            {view === "Guests" && <GuestsView state={state} extras={extras} patch={patch} headcount={headcount} notify={notify} />}
            {view === "Vendors" && <VendorsView state={state} vendors={vendors} extras={extras} patch={patch} notify={notify} />}
            {view === "Timeline" && <TimelineView state={state} milestones={milestones} toggle={(id) => patch({ done: { ...extras.done, [id]: !extras.done[id] } })} setModal={setModal} />}
            {view === "Checklist" && <ChecklistView extras={extras} patch={patch} notify={notify} />}
            {view === "Documents" && <DocumentsView extras={extras} patch={patch} notify={notify} onBrief={exportBrief} />}
            {view === "Inspiration" && <InspirationView extras={extras} patch={patch} setLightbox={setLightbox} notify={notify} />}
          </div>
        </section>
      </div>

      {/* Overlays */}
      {toast && <div className="toast" role="status"><Check size={16} style={{ color: "#6fd6cf" }} />{toast}</div>}
      {palette && <Palette commands={commands} onClose={() => setPalette(false)} />}
      {alertsOpen && (
        <>
          <button aria-label="Close alerts" className="fixed inset-0 z-[94] bg-black/30" onClick={() => setAlertsOpen(false)} />
          <aside className="drawer" aria-label="Plan alerts">
            <div className="mb-5 flex items-center justify-between"><h2 className="display text-2xl">Alerts</h2><button className="icon-btn icon-btn-sm" onClick={() => setAlertsOpen(false)} aria-label="Close"><X size={16} /></button></div>
            {alerts.length ? <div className="space-y-3">{alerts.map((a) => <div key={a.id} className="inset p-4"><span className={`chip chip-${a.tone}`}>{a.title}</span><p className="muted mt-2 text-sm leading-6">{a.body}</p></div>)}</div> : <Empty title="All clear" message="No alerts for this plan right now." />}
          </aside>
        </>
      )}
      {lightbox && (
        <div className="overlay" style={{ zIndex: 110 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}>
          <div className="w-full max-w-4xl">
            <Photo src={lightbox.src} alt={lightbox.title} className="aspect-[16/10] w-full" caption={`${lightbox.title} · ${lightbox.tag}`} />
            <div className="mt-4 flex justify-center gap-2">
              <button className="btn btn-sm" onClick={() => { patch({ pins: extras.pins.includes(lightbox.id) ? extras.pins.filter((p) => p !== lightbox.id) : [...extras.pins, lightbox.id] }); }}><Heart size={15} fill={extras.pins.includes(lightbox.id) ? "currentColor" : "none"} />{extras.pins.includes(lightbox.id) ? "Pinned to moodboard" : "Pin to moodboard"}</button>
              <button className="btn btn-primary btn-sm" onClick={() => setLightbox(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {modal === "auth" && <AuthModal onClose={() => setModal(null)} onSignedIn={(p) => { setProfile(p); setSignedIn(true); setModal(null); notify("Your verified profile is ready."); }} />}
      {modal === "subscription" && <SubscriptionModal onClose={() => setModal(null)} onPaid={() => { setModal("chat"); notify("Demo Pro access unlocked for 180 seconds."); }} />}
      {modal === "chat" && <ChatModal onClose={() => setModal(null)} onPaywall={() => setModal("subscription")} />}
      {modal === "create-plan" && <CreatePlanModal onClose={() => setModal(null)} onCreated={(p) => { applyGeneratedPlan(p); setModal(null); }} />}
      {modal === "settings" && <SettingsModal theme={extras.theme} setTheme={(t) => patch({ theme: t })} onClose={() => setModal(null)} onLogout={() => { setSignedIn(false); setModal(null); notify("You have been signed out."); }} onReset={() => { patch({ ...DEFAULT_EXTRAS, theme: extras.theme }); setModal(null); notify("Guests, tasks, expenses and documents were reset."); }} />}
      {modal === "profile" && <ProfileModal profile={profile} signedIn={signedIn} onClose={() => setModal(null)} onSignIn={() => setModal("auth")} />}
      {modal === "feedback" && <FeedbackModal onClose={() => setModal(null)} onDone={() => { setModal(null); notify("Thanks — your idea was added to the improvement queue."); }} />}
      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {modal === "share" && <ShareModal onClose={() => setModal(null)} onJson={exportPlan} onBrief={exportBrief} notify={notify} />}
    </main>
  );
}

/* ───────────────────────────── Command palette ───────────────────────────── */
function Palette({ commands, onClose }: { commands: { label: string; hint: string; icon: typeof Home; run: () => void }[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const list = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  const run = (i: number) => { const c = list[i]; if (c) { onClose(); c.run(); } };
  return (
    <div className="overlay" style={{ zIndex: 130, alignItems: "start" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-label="Command palette">
        <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: "var(--line)" }}>
          <Search size={18} className="muted" />
          <input autoFocus className="w-full bg-transparent text-[15px] outline-none" placeholder="Type a command or section…" value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(list.length - 1, i + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); } if (e.key === "Enter") run(idx); }} />
          <kbd>Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-2" role="listbox">
          {list.length ? list.map((c, i) => <button key={c.label} role="option" aria-selected={i === idx} className="palette-item" onMouseEnter={() => setIdx(i)} onClick={() => run(i)}><c.icon size={17} className="muted" />{c.label}<span className="muted ml-auto text-xs">{c.hint}</span></button>) : <p className="muted px-5 py-6 text-sm">No commands match “{q}”.</p>}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Overview ───────────────────────────── */
function Overview({ state, analytics, isDirty, extras, headcount, milestones, vendors, spent, tasksDone, nextMilestone, onValidate, onRestore, go, setModal, toggleMilestone, setLightbox, onExport }: {
  state: PlannerState; analytics: Analytics; isDirty: boolean; extras: Extras; headcount: number; milestones: Milestone[]; vendors: Vendor[]; spent: number; tasksDone: number;
  nextMilestone?: Milestone; onValidate: () => void; onRestore: () => void; go: (v: View) => void; setModal: (m: Modal) => void; toggleMilestone: (id: string) => void; setLightbox: (p: Photo) => void; onExport: () => void;
}) {
  const heroId = HERO_BY_TYPE[state.eventType] ?? HERO_BY_TYPE.Other;
  const largest = analytics.categoryBreakdown.reduce((cur, it) => it.amount > cur.amount ? it : cur, analytics.categoryBreakdown[0]);
  const insight = largest ? `${largest.label} takes ${Math.round(largest.percentage)}% of your allocation. ${analytics.remaining < 0 ? `Trim at least ${formatCurrency(Math.abs(analytics.remaining), state.currency)} before confirming another booking.` : `You still have ${formatCurrency(analytics.remaining, state.currency)} free for open decisions.`}` : "Add allocations to unlock plan-specific financial guidance.";
  const kpis = [
    { label: "Total budget", value: formatCurrency(analytics.budget, state.currency), pct: analytics.utilization, note: `${Math.round(analytics.utilization)}% allocated`, over: analytics.status === "over" },
    { label: "Spent so far", value: formatCurrency(spent, state.currency), pct: state.budget ? spent / state.budget * 100 : 0, note: spent ? "From your expense log" : "No expenses logged yet", over: spent > state.budget },
    { label: "Confirmed headcount", value: `${headcount} / ${state.guests}`, pct: state.guests ? headcount / state.guests * 100 : 0, note: extras.guests.length ? `${extras.guests.length} on guest list` : "Add guests to track RSVPs", over: false },
    { label: "Checklist", value: `${tasksDone} / ${extras.tasks.length}`, pct: extras.tasks.length ? tasksDone / extras.tasks.length * 100 : 0, note: "Tasks completed", over: false }
  ];
  return (
    <>
      <section className="hero p-6 sm:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={u(heroId, 2000)} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <div className="flex min-h-[290px] flex-col justify-between gap-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="glass inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold"><Sparkles size={13} />{state.eventType}</span>
            <div className="no-print flex flex-wrap gap-2">
              <button className="btn btn-sm hero-btn" onClick={() => setModal("create-plan")}><Plus size={15} />Create plan</button>
              <button className="btn btn-sm hero-btn" onClick={onExport}><Download size={15} />Brief</button>
              <button className="btn btn-sm hero-btn" onClick={() => setModal("share")}><Share2 size={15} />Share</button>
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[620px]">
              <h1 className="display text-4xl leading-[1.05] sm:text-6xl">{state.eventName}</h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80"><span className="inline-flex items-center gap-2"><CalendarDays size={15} />{fmtDate(state.eventDate)}</span><span className="inline-flex items-center gap-2"><MapPin size={15} />{state.location}</span></p>
            </div>
            <Countdown state={state} onValidate={onValidate} />
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <p className="muted text-xs font-semibold">{k.label}</p>
            <p className="display tnum mt-2 text-3xl">{k.value}</p>
            <div className={`track mt-4 ${k.over ? "over" : ""}`}><i style={{ width: `${Math.min(100, Math.max(0, k.pct))}%` }} /></div>
            <p className="muted mt-2 text-xs">{k.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <AnalyticsCard state={state} analytics={analytics} isDirty={isDirty} onValidate={onValidate} onRestore={onRestore} />
        <div className="space-y-5">
          <section className="card card-pad" style={{ background: "linear-gradient(160deg, var(--plum-soft), var(--paper) 70%)" }}>
            <div className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--plum)" }}><Sparkles size={17} />Plan intelligence</div>
            <p className="display mt-4 text-[22px] leading-8">{insight}</p>
            <button onClick={() => setModal("chat")} className="linkish mt-5 inline-flex items-center gap-1">Ask about this allocation <ArrowUpRight size={14} /></button>
          </section>
          <section className="card card-pad">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="display text-2xl">Next up</h2><p className="muted mt-1 text-xs">{nextMilestone ? nextMilestone.date : "Everything is complete"}</p></div><button className="linkish" onClick={() => go("Timeline")}>View all</button></div>
            {milestones.length ? milestones.slice(0, 4).map((m) => (
              <div className="row" key={m.id}>
                <button className={`tl-node ${m.status === "complete" ? "done" : m.status === "active" ? "active" : ""}`} onClick={() => toggleMilestone(m.id)} aria-label={`Mark ${m.title} ${m.status === "complete" ? "incomplete" : "complete"}`}><Check size={14} /></button>
                <div className="min-w-0"><p className={`text-sm font-bold ${m.status === "complete" ? "done-text" : ""}`}>{m.title}</p><p className="muted text-xs">{m.date}</p></div>
              </div>
            )) : <Empty title="No timeline yet" message="Generate a plan to create milestones." />}
          </section>
        </div>
      </div>

      <section className="mt-5 card card-pad">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="display text-2xl">Moodboard</h2><p className="muted mt-1 text-sm">Your pinned inspiration. Tap an image to enlarge it.</p></div><button className="btn btn-sm" onClick={() => go("Inspiration")}>Browse inspiration<ChevronRight size={15} /></button></div>
        {extras.pins.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{PHOTOS.filter((p) => extras.pins.includes(p.id)).slice(0, 4).map((p) => <button key={p.id} className="aspect-[4/5] text-left" onClick={() => setLightbox(p)} aria-label={`Open ${p.title}`}><Photo src={p.src} alt={p.title} className="h-full w-full" caption={p.title} /></button>)}</div> : <Empty title="Nothing pinned yet" message="Pin images in Inspiration to build your moodboard." action={<button className="btn btn-primary btn-sm" onClick={() => go("Inspiration")}>Find inspiration</button>} />}
      </section>

      <section className="mt-5 card card-pad">
        <div className="mb-3 flex items-center justify-between"><div><h2 className="display text-2xl">Vendor shortlist</h2><p className="muted mt-1 text-sm">{vendors.length} partner{vendors.length === 1 ? "" : "s"} under consideration</p></div><button className="linkish" onClick={() => go("Vendors")}>Manage vendors</button></div>
        {vendors.length ? vendors.slice(0, 4).map((v) => <div key={v.id} className="row"><div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "var(--gold-soft)", color: "var(--gold-deep)" }}><Star size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{v.vendor}</p><p className="muted text-xs">{v.rating} ★ · {v.fit}</p></div><p className="tnum text-sm font-bold">{formatCurrency(v.quote)}</p></div>) : <Empty title="No vendors yet" message="Add a vendor to compare quotes." />}
      </section>
    </>
  );
}

/* ───────────────────────────── Budget analytics (shared) ───────────────────────────── */
function AnalyticsCard({ state, analytics, isDirty, onValidate, onRestore }: { state: PlannerState; analytics: Analytics; isDirty: boolean; onValidate: () => void; onRestore: () => void }) {
  const [selectedId, setSelectedId] = useState("");
  const rows = analytics.categoryBreakdown;
  const selected = rows.find((c) => c.id === selectedId) ?? rows[0];
  const cur = state.currency;
  const statusLabel = analytics.status === "over" ? "Over budget" : analytics.status === "balanced" ? "Fully allocated" : analytics.status === "invalid" ? "Needs valid budget" : "Under budget";
  let acc = 0;
  const stops = rows.map((c) => { const from = acc; acc += c.percentage; return `${c.color} ${from}% ${acc}%`; });
  const donut = rows.length && acc > 0 ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(var(--line-2) 0 100%)";
  return (
    <section className="card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex flex-wrap items-center gap-3"><h2 className="display text-2xl">Budget analytics</h2><span className={`chip ${analytics.status === "over" || analytics.status === "invalid" ? "chip-rose" : "chip-teal"}`}>{statusLabel}</span></div><p className="muted mt-1 text-sm">Calculated from your editable plan, not sample figures.</p></div>
        <div className="no-print flex flex-wrap items-center gap-2">
          {isDirty && <span className="chip chip-gold">Unsaved changes</span>}
          <button onClick={onRestore} disabled={!isDirty} className="btn btn-sm"><RotateCcw size={14} />Restore</button>
          <button onClick={onValidate} className="btn btn-primary btn-sm">Validate plan</button>
        </div>
      </div>
      <div className="mt-7 flex flex-col items-center gap-8 md:flex-row">
        <div className="donut" style={{ background: donut }} role="img" aria-label="Allocation share by category"><div><p className="display tnum text-3xl">{Math.round(analytics.utilization)}%</p><p className="muted text-xs">of budget</p></div></div>
        <div className="w-full min-w-0 flex-1">
          {rows.length ? rows.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)} className="flex w-full items-center gap-3 rounded-xl border-0 px-3 py-2.5 text-left" style={{ background: selected?.id === c.id ? "var(--gold-soft)" : "transparent" }}>
              <span className="dot" style={{ background: c.color }} /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.label}</span><span className="muted text-xs">{Math.round(c.percentage)}%</span><span className="tnum w-24 text-right text-sm font-bold">{formatCurrency(c.amount, cur)}</span>
            </button>
          )) : <Empty title="No allocations" message="Add category amounts in the Budget section." />}
        </div>
      </div>
      <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-3" style={{ borderColor: "var(--line)" }}>
        <div><p className="muted text-xs">Cost per guest</p><p className="tnum mt-1 font-bold">{analytics.costPerGuest === null ? "Unavailable" : formatCurrency(analytics.costPerGuest, cur)}</p></div>
        <div><p className="muted text-xs">Since previous validated plan</p><p className="tnum mt-1 font-bold" style={{ color: analytics.change !== null && analytics.change > 0 ? "var(--rose)" : "var(--teal)" }}>{analytics.change === null ? "No comparison yet" : `${analytics.change >= 0 ? "+" : ""}${formatCurrency(analytics.change, cur)}`}</p></div>
        <div><p className="muted text-xs">Validation</p><p className="mt-1 text-sm font-bold">{state.validation?.message ?? "Draft — validate to confirm"}</p></div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Budget view ───────────────────────────── */
function BudgetView({ state, analytics, health, isDirty, extras, patch, onValidate, onRestore, onSave, updateNumber, updateCategory, updateCurrency, notify }: {
  state: PlannerState; analytics: Analytics; health: ReturnType<typeof getBudgetHealth>; isDirty: boolean; extras: Extras; patch: (p: Partial<Extras>) => void;
  onValidate: () => void; onRestore: () => void; onSave: () => void; updateNumber: (k: "budget" | "guests", v: string) => void; updateCategory: (id: string, v: string) => void; updateCurrency: (v: string) => void; notify: (m: string) => void;
}) {
  const [exp, setExp] = useState({ label: "", categoryId: state.categories[0]?.id ?? "", amount: "" });
  const [delta, setDelta] = useState(0);
  const cur = state.currency;
  const spentBy = (id: string) => extras.expenses.filter((e) => e.categoryId === id).reduce((s, e) => s + e.amount, 0);
  const addExpense = () => {
    const amount = Number(exp.amount);
    if (!exp.label.trim() || !Number.isFinite(amount) || amount <= 0) return notify("Add a label and an amount above zero.");
    patch({ expenses: [{ id: uid(), label: exp.label.trim(), categoryId: exp.categoryId || state.categories[0]?.id || "", amount, date: today() }, ...extras.expenses] });
    setExp({ ...exp, label: "", amount: "" }); notify("Expense logged.");
  };
  const perGuest = analytics.costPerGuest;
  const projected = perGuest === null ? null : perGuest * Math.max(0, state.guests + delta);
  return (
    <>
      <SectionHead title="Budget studio" sub="Edit allocations, log real spending and test guest scenarios." actions={<><button className="btn btn-sm" onClick={onSave}>Save draft</button><button className="btn btn-sm" onClick={onRestore} disabled={!isDirty}><RotateCcw size={14} />Discard edits</button><button className="btn btn-primary btn-sm" onClick={onValidate}>Validate plan</button></>} />
      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <section className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="display text-2xl">Plan editor</h2>{isDirty && <span className="chip chip-gold">Unsaved changes</span>}</div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="label">Total budget<input type="number" min="0" className="field" value={state.budget} onChange={(e) => updateNumber("budget", e.target.value)} /></label>
            <label className="label">Guest count<input type="number" min="0" className="field" value={state.guests} onChange={(e) => updateNumber("guests", e.target.value)} /></label>
            <label className="label">Currency<select className="field" value={state.currency ?? "INR"} onChange={(e) => updateCurrency(e.target.value)}><option value="INR">INR (₹)</option><option value="USD">USD ($)</option></select></label>
          </div>
          <div className="mt-6 flex items-center justify-between"><h3 className="text-sm font-bold">Allocations</h3><span className="text-xs font-bold" style={{ color: analytics.remaining < 0 ? "var(--rose)" : "var(--muted)" }}>{analytics.remaining < 0 ? `${formatCurrency(Math.abs(analytics.remaining), cur)} over` : `${formatCurrency(analytics.remaining, cur)} unallocated`}</span></div>
          <div className={`track mt-3 ${health.over ? "over" : ""}`}><i style={{ width: `${Math.min(100, Math.max(0, health.percent))}%` }} /></div>
          <div className="mt-4 space-y-3">
            {state.categories.map((c) => {
              const sp = spentBy(c.id);
              return (
                <label key={c.id} className="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-3">
                  <span className="min-w-0"><span className="flex items-center gap-2 text-sm font-semibold"><span className="dot" style={{ background: c.color }} /><span className="truncate">{c.label}</span></span>{sp > 0 && <span className="muted ml-5 block text-xs">Spent {formatCurrency(sp, cur)} · {c.amount ? Math.round(sp / c.amount * 100) : 0}% of allocation</span>}</span>
                  <input type="number" min="0" className="field text-right font-bold" value={c.amount} onChange={(e) => updateCategory(c.id, e.target.value)} />
                </label>
              );
            })}
          </div>
          {(state.validation?.status === "warning" || state.validation?.status === "invalid") && <p className="mt-5 rounded-xl p-3 text-xs font-semibold" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>{state.validation.message}</p>}
        </section>

        <div className="space-y-5">
          <section className="card card-pad">
            <h2 className="display text-2xl">Expense log</h2><p className="muted mt-1 text-sm">Record what you actually pay. Totals feed your dashboard.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="label sm:col-span-2">What was it for?<input className="field" placeholder="Venue advance" value={exp.label} onChange={(e) => setExp({ ...exp, label: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addExpense(); }} /></label>
              <label className="label">Category<select className="field" value={exp.categoryId} onChange={(e) => setExp({ ...exp, categoryId: e.target.value })}>{state.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
              <label className="label">Amount<input type="number" min="0" className="field" placeholder="25000" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} /></label>
            </div>
            <button className="btn btn-primary btn-block mt-4" onClick={addExpense}><Plus size={16} />Log expense</button>
            <div className="mt-5">
              {extras.expenses.length ? extras.expenses.slice(0, 6).map((e) => <div className="row" key={e.id}><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{e.label}</p><p className="muted text-xs">{state.categories.find((c) => c.id === e.categoryId)?.label ?? "Uncategorised"} · {e.date}</p></div><p className="tnum text-sm font-bold">{formatCurrency(e.amount, cur)}</p><button className="icon-btn icon-btn-sm" aria-label={`Delete ${e.label}`} onClick={() => patch({ expenses: extras.expenses.filter((x) => x.id !== e.id) })}><Trash2 size={14} /></button></div>) : <Empty title="No expenses yet" message="Your first logged payment will appear here." />}
            </div>
          </section>
          <section className="card card-pad">
            <h2 className="display text-2xl">What if guests change?</h2>
            <p className="muted mt-1 text-sm">Assumes every cost scales per guest, so treat it as an upper bound.</p>
            <div className="mt-5 flex items-center gap-4"><input type="range" min={-50} max={150} step={5} value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="w-full" style={{ accentColor: "#e9a23b" }} aria-label="Change in guests" /><span className="tnum w-16 text-right text-sm font-bold">{delta > 0 ? "+" : ""}{delta}</span></div>
            {projected === null ? <p className="muted mt-4 text-sm">Set a valid budget and guest count to model scenarios.</p> : (
              <div className="mt-4 grid grid-cols-2 gap-3"><div className="inset p-4"><p className="muted text-xs">Projected allocation</p><p className="display tnum mt-1 text-2xl">{formatCurrency(projected, cur)}</p></div><div className="inset p-4"><p className="muted text-xs">Against budget</p><p className="display tnum mt-1 text-2xl" style={{ color: projected > state.budget ? "var(--rose)" : "var(--teal)" }}>{projected > state.budget ? "+" : "−"}{formatCurrency(Math.abs(projected - state.budget), cur)}</p></div></div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────────── Guests ───────────────────────────── */
function GuestsView({ state, extras, patch, headcount, notify }: { state: PlannerState; extras: Extras; patch: (p: Partial<Extras>) => void; headcount: number; notify: (m: string) => void }) {
  const [form, setForm] = useState({ name: "", group: "Family", meal: "Vegetarian", plusOnes: "0" });
  const [filter, setFilter] = useState<"all" | Rsvp>("all");
  const [q, setQ] = useState("");
  const list = extras.guests.filter((g) => (filter === "all" || g.rsvp === filter) && g.name.toLowerCase().includes(q.toLowerCase()));
  const count = (r: Rsvp) => extras.guests.filter((g) => g.rsvp === r).length;
  const add = () => {
    if (!form.name.trim()) return notify("Enter the guest's name first.");
    patch({ guests: [{ id: uid(), name: form.name.trim(), group: form.group, meal: form.meal, rsvp: "pending", plusOnes: Math.max(0, Number(form.plusOnes) || 0) }, ...extras.guests] });
    setForm({ ...form, name: "", plusOnes: "0" }); notify("Guest added.");
  };
  const exportCsv = () => { download("guest-list.csv", ["Name,Group,Meal,RSVP,Plus ones", ...extras.guests.map((g) => `"${g.name}",${g.group},${g.meal},${g.rsvp},${g.plusOnes}`)].join("\n"), "text/csv"); notify("Guest list exported."); };
  const remind = () => { const n = count("pending"); notify(n ? `Reminder queued for ${n} pending guest${n > 1 ? "s" : ""}.` : "No pending RSVPs to remind."); };
  const stats: { label: string; value: number; chip: string }[] = [{ label: "Confirmed", value: count("confirmed"), chip: "chip-teal" }, { label: "Pending", value: count("pending"), chip: "chip-gold" }, { label: "Declined", value: count("declined"), chip: "chip-rose" }, { label: "Confirmed headcount", value: headcount, chip: "" }];
  return (
    <>
      <SectionHead title="Guest command" sub={`${state.guests} planned · ${headcount} confirmed including plus-ones`} actions={<><button className="btn btn-sm" onClick={remind}><Mail size={14} />Remind pending</button><button className="btn btn-sm" onClick={exportCsv} disabled={!extras.guests.length}><Download size={14} />Export CSV</button></>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((s) => <div key={s.label} className="card p-5"><span className={`chip ${s.chip}`}>{s.label}</span><p className="display tnum mt-3 text-4xl">{s.value}</p></div>)}</div>
      {headcount > state.guests && <p className="mb-5 rounded-xl p-3 text-sm font-semibold" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>Confirmed headcount is above your planned guest count. Update the plan so catering costs stay accurate.</p>}
      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <section className="card card-pad self-start">
          <h2 className="display text-2xl">Add a guest</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="label sm:col-span-2">Full name<input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Ananya Rao" /></label>
            <label className="label">Group<select className="field" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>{["Family", "Friends", "Work", "VIP"].map((g) => <option key={g}>{g}</option>)}</select></label>
            <label className="label">Meal<select className="field" value={form.meal} onChange={(e) => setForm({ ...form, meal: e.target.value })}>{["Vegetarian", "Non-vegetarian", "Jain", "Vegan"].map((g) => <option key={g}>{g}</option>)}</select></label>
            <label className="label sm:col-span-2">Plus-ones<input type="number" min="0" className="field" value={form.plusOnes} onChange={(e) => setForm({ ...form, plusOnes: e.target.value })} /></label>
          </div>
          <button className="btn btn-primary btn-block mt-4" onClick={add}><Plus size={16} />Add guest</button>
          {!extras.guests.length && <button className="btn btn-block mt-2" onClick={() => { patch({ guests: SAMPLE_GUESTS }); notify("Sample guest list loaded."); }}>Load a sample list</button>}
        </section>
        <section className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="tabs" role="group" aria-label="Filter by RSVP">{(["all", "confirmed", "pending", "declined"] as const).map((f) => <button key={f} className="tab" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}</div>
            <div className="relative w-full sm:w-56"><Search size={15} className="muted absolute left-3 top-1/2 -translate-y-1/2" /><input className="field" style={{ paddingLeft: 36 }} placeholder="Search guests" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search guests" /></div>
          </div>
          <div className="mt-4">
            {list.length ? list.map((g) => (
              <div className="row" key={g.id}>
                <div className="grid h-10 w-10 flex-none place-items-center rounded-full text-xs font-bold" style={{ background: "var(--plum-soft)", color: "var(--plum)" }}>{initials(g.name)}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{g.name}{g.plusOnes > 0 && <span className="muted font-semibold"> +{g.plusOnes}</span>}</p><p className="muted text-xs">{g.group} · {g.meal}</p></div>
                <button className={`chip ${g.rsvp === "confirmed" ? "chip-teal" : g.rsvp === "pending" ? "chip-gold" : "chip-rose"}`} style={{ border: 0 }} onClick={() => patch({ guests: extras.guests.map((x) => x.id === g.id ? { ...x, rsvp: RSVP_NEXT[x.rsvp] } : x) })} aria-label={`RSVP ${g.rsvp}. Click to change`}>{g.rsvp}</button>
                <button className="icon-btn icon-btn-sm" aria-label={`Remove ${g.name}`} onClick={() => patch({ guests: extras.guests.filter((x) => x.id !== g.id) })}><Trash2 size={14} /></button>
              </div>
            )) : <Empty title={extras.guests.length ? "No guests match" : "No RSVP records yet"} message={extras.guests.length ? "Try a different filter or search." : "Add names as invitations go out. Click a status chip to cycle it."} />}
          </div>
        </section>
      </div>
    </>
  );
}

/* ───────────────────────────── Vendors ───────────────────────────── */
function VendorsView({ state, vendors, extras, patch, notify }: { state: PlannerState; vendors: Vendor[]; extras: Extras; patch: (p: Partial<Extras>) => void; notify: (m: string) => void }) {
  const [sort, setSort] = useState<"quote" | "rating">("rating");
  const [form, setForm] = useState({ vendor: "", fit: "", quote: "", rating: "4.5" });
  const [open, setOpen] = useState(false);
  const sorted = [...vendors].sort((a, b) => sort === "quote" ? a.quote - b.quote : Number(b.rating) - Number(a.rating));
  const set = (id: string, s: VStatus | null, msg: string) => { const next = { ...extras.vstatus }; if (s) next[id] = s; else delete next[id]; patch({ vstatus: next }); notify(msg); };
  const add = () => {
    const quote = Number(form.quote);
    if (!form.vendor.trim() || !Number.isFinite(quote) || quote <= 0) return notify("Add a vendor name and a quote above zero.");
    patch({ customVendors: [...extras.customVendors, { id: `c-${uid()}`, vendor: form.vendor.trim(), fit: form.fit.trim() || "Custom vendor", quote, rating: Number(form.rating) || 4 } as unknown as Vendor] });
    setForm({ vendor: "", fit: "", quote: "", rating: "4.5" }); setOpen(false); notify("Vendor added to your shortlist.");
  };
  const booked = vendors.filter((v) => extras.vstatus[v.id] === "booked").reduce((s, v) => s + v.quote, 0);
  return (
    <>
      <SectionHead title="Vendor marketplace" sub="Compare quotes, then request or book directly from the shortlist." actions={<>
        <div className="tabs" role="group" aria-label="Sort vendors"><button className="tab" aria-pressed={sort === "rating"} onClick={() => setSort("rating")}>Top rated</button><button className="tab" aria-pressed={sort === "quote"} onClick={() => setSort("quote")}>Lowest quote</button></div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen((o) => !o)}><Plus size={15} />Add vendor</button></>} />
      {booked > 0 && <p className="mb-5 chip chip-teal">Booked so far: {formatCurrency(booked, state.currency)}</p>}
      {open && (
        <section className="card card-pad mb-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="label sm:col-span-2">Vendor name<input className="field" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Rajmahal Caterers" /></label>
            <label className="label">Quote<input type="number" min="0" className="field" value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} /></label>
            <label className="label">Rating<input type="number" min="1" max="5" step="0.1" className="field" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} /></label>
            <label className="label sm:col-span-4">What they offer<input className="field" value={form.fit} onChange={(e) => setForm({ ...form, fit: e.target.value })} placeholder="Rajasthani thali, live counters" /></label>
          </div>
          <div className="mt-4 flex gap-2"><button className="btn btn-primary btn-sm" onClick={add}>Save vendor</button><button className="btn btn-sm" onClick={() => setOpen(false)}>Cancel</button></div>
        </section>
      )}
      {sorted.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((v, i) => {
            const status = extras.vstatus[v.id];
            return (
              <article key={v.id} className="card overflow-hidden">
                <Photo src={u(["1555244162-803834f70033", "1511795409834-ef04bbd61622", "1505236858219-8359eb29e329", "1469371670807-013ccf25f16a"][i % 4], 800)} alt="" className="h-40 w-full rounded-none" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3"><h3 className="display text-xl leading-tight">{v.vendor}</h3>{status && <span className={`chip ${status === "booked" ? "chip-teal" : "chip-gold"}`}>{status}</span>}</div>
                  <p className="muted mt-1 flex items-center gap-1 text-xs"><Star size={12} fill="#e9a23b" stroke="#e9a23b" />{v.rating} · {v.fit}</p>
                  <p className="display tnum mt-4 text-3xl">{formatCurrency(v.quote)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="btn btn-sm" onClick={() => status === "shortlisted" ? set(v.id, null, "Removed from shortlist.") : set(v.id, "shortlisted", `${v.vendor} shortlisted.`)}><Heart size={14} fill={status ? "currentColor" : "none"} />{status ? "Saved" : "Save"}</button>
                    <button className="btn btn-sm" disabled={status === "booked"} onClick={() => set(v.id, "requested", `Quote request prepared for ${v.vendor}.`)}>Request quote</button>
                    <button className="btn btn-gold btn-sm" disabled={status === "booked"} onClick={() => set(v.id, "booked", `${v.vendor} marked as booked.`)}>{status === "booked" ? "Booked" : "Book"}</button>
                    {v.id.startsWith("c-") && <button className="icon-btn icon-btn-sm" aria-label={`Delete ${v.vendor}`} onClick={() => patch({ customVendors: extras.customVendors.filter((x) => x.id !== v.id) })}><Trash2 size={14} /></button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : <Empty title="No vendors yet" message="Add your first vendor to start comparing quotes." action={<button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>Add vendor</button>} />}
    </>
  );
}

/* ───────────────────────────── Timeline ───────────────────────────── */
function TimelineView({ state, milestones, toggle, setModal }: { state: PlannerState; milestones: Milestone[]; toggle: (id: string) => void; setModal: (m: Modal) => void }) {
  const done = milestones.filter((m) => m.status === "complete").length;
  const pct = milestones.length ? done / milestones.length * 100 : 0;
  return (
    <>
      <SectionHead title="Milestone timeline" sub={`Derived from your ${state.eventType.toLowerCase()} on ${fmtDate(state.eventDate)}`} actions={<button className="btn btn-sm" onClick={() => setModal("create-plan")}><Sparkles size={14} />Regenerate with AI</button>} />
      <section className="card card-pad">
        <div className="mb-6 flex items-center gap-4"><div className="track flex-1"><i style={{ width: `${pct}%` }} /></div><span className="tnum text-sm font-bold">{done}/{milestones.length} done</span></div>
        {milestones.length ? milestones.map((m, i) => (
          <div className="flex gap-4" key={m.id}>
            <div className="flex flex-col items-center"><button className={`tl-node ${m.status === "complete" ? "done" : m.status === "active" ? "active" : ""}`} onClick={() => toggle(m.id)} aria-label={`Mark ${m.title} ${m.status === "complete" ? "incomplete" : "complete"}`}><Check size={14} /></button>{i < milestones.length - 1 && <div className="my-1 w-px flex-1" style={{ background: "var(--line-2)" }} />}</div>
            <div className="pb-8"><p className={`text-[15px] font-bold ${m.status === "complete" ? "done-text" : ""}`}>{m.title}</p><p className="muted mt-1 max-w-xl text-sm leading-6">{m.description}</p><p className="muted mt-2 inline-flex items-center gap-1 text-xs font-bold"><Clock3 size={12} />{m.date}</p></div>
          </div>
        )) : <Empty title="No timeline returned" message="Generate or edit a plan to create event-specific milestones." />}
      </section>
    </>
  );
}

/* ───────────────────────────── Checklist ───────────────────────────── */
function ChecklistView({ extras, patch, notify }: { extras: Extras; patch: (p: Partial<Extras>) => void; notify: (m: string) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const list = extras.tasks.filter((t) => filter === "all" || (filter === "done" ? t.done : !t.done));
  const done = extras.tasks.filter((t) => t.done).length;
  const pct = extras.tasks.length ? done / extras.tasks.length * 100 : 0;
  const add = () => { if (!title.trim()) return notify("Write the task first."); patch({ tasks: [{ id: uid(), title: title.trim(), due, done: false }, ...extras.tasks] }); setTitle(""); setDue(""); notify("Task added."); };
  return (
    <>
      <SectionHead title="Planning checklist" sub="Everything that must happen, in one calm list." actions={<button className="btn btn-sm" disabled={!done} onClick={() => { patch({ tasks: extras.tasks.filter((t) => !t.done) }); notify("Completed tasks cleared."); }}>Clear completed</button>} />
      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <section className="card card-pad self-start">
          <div className="donut mx-auto" style={{ background: `conic-gradient(var(--gold) ${pct}%, var(--line-2) 0)` }}><div><p className="display tnum text-4xl">{Math.round(pct)}%</p><p className="muted text-xs">{done} of {extras.tasks.length}</p></div></div>
          <div className="mt-6 space-y-3">
            <label className="label">New task<input className="field" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Book the mehendi artist" /></label>
            <label className="label">Due date<input type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} /></label>
            <button className="btn btn-primary btn-block" onClick={add}><Plus size={16} />Add task</button>
          </div>
        </section>
        <section className="card card-pad">
          <div className="tabs mb-3" role="group" aria-label="Filter tasks">{(["all", "open", "done"] as const).map((f) => <button key={f} className="tab" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}</div>
          {list.length ? list.map((t) => (
            <div className="row" key={t.id}>
              <input type="checkbox" className="tick" checked={t.done} onChange={() => patch({ tasks: extras.tasks.map((x) => x.id === t.id ? { ...x, done: !x.done } : x) })} aria-label={`Complete ${t.title}`} />
              <div className="min-w-0 flex-1"><p className={`text-sm font-semibold ${t.done ? "done-text" : ""}`}>{t.title}</p>{t.due && <p className="muted mt-1 text-xs">Due {fmtDate(t.due)}</p>}</div>
              <button className="icon-btn icon-btn-sm" aria-label={`Delete ${t.title}`} onClick={() => patch({ tasks: extras.tasks.filter((x) => x.id !== t.id) })}><Trash2 size={14} /></button>
            </div>
          )) : <Empty title="Nothing here" message={filter === "done" ? "Completed tasks will appear here." : "You're all caught up."} />}
        </section>
      </div>
    </>
  );
}

/* ───────────────────────────── Documents ───────────────────────────── */
function DocumentsView({ extras, patch, notify, onBrief }: { extras: Extras; patch: (p: Partial<Extras>) => void; notify: (m: string) => void; onBrief: () => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const added: Doc[] = Array.from(files).map((f) => ({ id: uid(), name: f.name, kind: f.name.split(".").pop()?.toUpperCase() || "FILE", size: sizeLabel(f.size), added: today() }));
    patch({ docs: [...added, ...extras.docs] }); notify(`${added.length} document${added.length > 1 ? "s" : ""} added.`);
  };
  const templates = ["Vendor contract", "Run-of-show", "Seating plan", "Payment schedule"];
  return (
    <>
      <SectionHead title="Event documents" sub="Contracts, quotes and briefs. Files stay on this device." actions={<button className="btn btn-sm" onClick={onBrief}><Download size={14} />Generate event brief</button>} />
      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <div className="space-y-5 self-start">
          <section className={`drop ${over ? "over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
            <Upload size={26} className="mx-auto" style={{ color: "var(--gold-deep)" }} />
            <p className="mt-3 text-sm font-bold">Drop files here</p><p className="muted mt-1 text-xs">or choose from your device</p>
            <button className="btn btn-primary btn-sm mt-4" onClick={() => input.current?.click()}>Choose files</button>
            <input ref={input} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </section>
          <section className="card card-pad"><h2 className="display text-xl">Start from a template</h2><div className="mt-4 flex flex-wrap gap-2">{templates.map((t) => <button key={t} className="btn btn-sm" onClick={() => { patch({ docs: [{ id: uid(), name: `${t}.docx`, kind: "DOCX", size: "Template", added: today() }, ...extras.docs] }); notify(`${t} added to your library.`); }}><Plus size={14} />{t}</button>)}</div></section>
        </div>
        <section className="card card-pad">
          <h2 className="display text-2xl">Library</h2>
          <div className="mt-3">{extras.docs.length ? extras.docs.map((d) => <div className="row" key={d.id}><div className="grid h-10 w-10 flex-none place-items-center rounded-xl text-[11px] font-bold" style={{ background: "var(--plum-soft)", color: "var(--plum)" }}>{d.kind.slice(0, 4)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{d.name}</p><p className="muted text-xs">{d.size} · Added {d.added}</p></div><button className="icon-btn icon-btn-sm" aria-label={`Delete ${d.name}`} onClick={() => patch({ docs: extras.docs.filter((x) => x.id !== d.id) })}><Trash2 size={14} /></button></div>) : <Empty title="No documents yet" message="Upload a file or start from a template to build your library." />}</div>
        </section>
      </div>
    </>
  );
}

/* ───────────────────────────── Inspiration ───────────────────────────── */
function InspirationView({ extras, patch, setLightbox, notify }: { extras: Extras; patch: (p: Partial<Extras>) => void; setLightbox: (p: Photo) => void; notify: (m: string) => void }) {
  const tags = ["All", ...Array.from(new Set(PHOTOS.map((p) => p.tag)))];
  const [tag, setTag] = useState("All");
  const shown = PHOTOS.filter((p) => tag === "All" || p.tag === tag);
  const pin = (id: string) => { const on = extras.pins.includes(id); patch({ pins: on ? extras.pins.filter((p) => p !== id) : [...extras.pins, id] }); notify(on ? "Removed from moodboard." : "Pinned to moodboard."); };
  return (
    <>
      <SectionHead title="Inspiration" sub={`${extras.pins.length} pinned to your moodboard`} actions={<div className="tabs" role="group" aria-label="Filter inspiration">{tags.map((t) => <button key={t} className="tab" aria-pressed={tag === t} onClick={() => setTag(t)}>{t}</button>)}</div>} />
      <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
        {shown.map((p, i) => (
          <div key={p.id} className="relative mb-4 break-inside-avoid">
            <button className="block w-full text-left" onClick={() => setLightbox(p)} aria-label={`Open ${p.title}`}><Photo src={p.src} alt={p.title} className={i % 3 === 0 ? "aspect-[4/5]" : "aspect-[4/3]"} caption={`${p.title} · ${p.tag}`} /></button>
            <button className="icon-btn icon-btn-sm absolute right-3 top-3" style={{ background: "rgba(20,14,40,.6)", borderColor: "rgba(255,255,255,.3)", color: "#fff" }} onClick={() => pin(p.id)} aria-label={extras.pins.includes(p.id) ? `Unpin ${p.title}` : `Pin ${p.title}`}><Heart size={15} fill={extras.pins.includes(p.id) ? "#e9a23b" : "none"} stroke={extras.pins.includes(p.id) ? "#e9a23b" : "currentColor"} /></button>
          </div>
        ))}
      </div>
    </>
  );
}

/* ───────────────────────────── Modals ───────────────────────────── */
function ShareModal({ onClose, onJson, onBrief, notify }: { onClose: () => void; onJson: () => void; onBrief: () => void; notify: (m: string) => void }) {
  const copy = async () => { try { await navigator.clipboard.writeText(window.location.href); notify("Link copied to clipboard."); } catch { notify("Copy failed. Select the address bar link instead."); } };
  const items = [{ icon: Copy, label: "Copy page link", run: copy }, { icon: FileText, label: "Download event brief (.txt)", run: onBrief }, { icon: Download, label: "Download full plan (.json)", run: onJson }, { icon: Printer, label: "Print this view", run: () => { onClose(); window.setTimeout(() => window.print(), 250); } }];
  return <ModalShell title="Share & export" sub="Send your plan to family and vendors, or keep a copy." onClose={onClose}><div className="mt-6 space-y-3">{items.map(({ icon: Icon, label, run }) => <button key={label} onClick={() => void run()} className="btn btn-block justify-start"><Icon size={17} style={{ color: "var(--gold-deep)" }} />{label}</button>)}</div></ModalShell>;
}

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
    const data = await response.json() as { error?: string; profile?: { name: string; email: string } };
    if (!response.ok) throw new Error(data.error || "The request failed.");
    return data;
  };
  const run = async (url: string, body: unknown, fallback: string) => {
    setBusy(true); setError("");
    try { const data = await submitJson(url, body); if (data.profile) onSignedIn(data.profile); } catch (e) { setError(e instanceof Error ? e.message : fallback); } finally { setBusy(false); }
  };
  const submit = () => {
    if (captcha !== captchaAnswer) return setError("CAPTCHA answer is incorrect.");
    void (stage === "login" ? run("/api/auth/login", { username, password }, "Login failed.") : run("/api/auth/register", { username, password, email, displayName: name }, "Registration failed."));
  };
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || !googleButton.current) return;
    const render = () => {
      if (!window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, ux_mode: "popup", callback: (r) => void run("/api/auth/google/credential", { credential: r.credential }, "Google sign-in failed.") });
      googleButton.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButton.current, { theme: "outline", size: "large", width: 400, text: "signin_with" });
    };
    if (window.google) { render(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.defer = true; script.onload = render;
    document.head.appendChild(script);
    return () => { script.onload = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <ModalShell title={stage === "login" ? "Welcome back" : "Create your account"} sub="Use Google for one-click access, or continue with a local PlanOdyssey account." onClose={onClose}>
      {error && <p className="mt-4 rounded-xl p-3 text-xs font-semibold" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>{error}</p>}
      <div ref={googleButton} className="mt-5 flex min-h-10 justify-center" />
      <div className="muted my-4 flex items-center gap-3 text-xs font-semibold"><span className="h-px flex-1" style={{ background: "var(--line-2)" }} />or<span className="h-px flex-1" style={{ background: "var(--line-2)" }} /></div>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="label">Username<input autoFocus autoComplete="username" className="field" value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        {stage === "register" && <><label className="label">Display name<input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label><label className="label">Email<input type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></label></>}
        <label className="label">Password<input type="password" autoComplete={stage === "login" ? "current-password" : "new-password"} className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="label inset p-3">Quick check: what is 1 + {captchaAnswer}?<input className="field" inputMode="numeric" value={captcha} onChange={(e) => setCaptcha(e.target.value)} /></label>
        <button type="submit" disabled={busy} className="btn btn-primary btn-block">{busy ? "Working…" : stage === "login" ? "Log in" : "Register"}</button>
      </form>
      <button disabled={busy} onClick={() => setStage(stage === "login" ? "register" : "login")} className="linkish mt-4 w-full text-center">{stage === "login" ? "New here? Create an account" : "Already registered? Log in"}</button>
    </ModalShell>
  );
}

function SubscriptionModal({ onClose, onPaid }: { onClose: () => void; onPaid: () => void }) {
  const [plan, setPlan] = useState("pro");
  const [method, setMethod] = useState("UPI / QR");
  const [seconds, setSeconds] = useState(180);
  useEffect(() => { const i = window.setInterval(() => setSeconds((s) => s > 0 ? s - 1 : 0), 1000); return () => window.clearInterval(i); }, []);
  const plans = [
    { id: "free", name: "Free", price: "₹0", detail: "For trying the command center", items: ["1 active event", "50 guests", "Manual budget tracking", "Basic milestones", "Community support"] },
    { id: "basic", name: "Basic", price: "₹499/mo", detail: "For personal celebrations", items: ["5 active events", "500 guests per event", "Gemini planning prompts", "Vendor quote comparison", "Google sign-in support"] },
    { id: "pro", name: "Pro", price: "₹1,499/mo", detail: "For complex, high-touch events", items: ["Unlimited events and guests", "Location-aware AI research", "Scenario budget modelling", "Hotel and vendor briefs", "Priority support and exports"] }
  ];
  return (
    <ModalShell title="Choose your plan" sub="Compare every tier. Demo checkout never charges a real card or UPI account." onClose={onClose} wide>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {plans.map((p) => (
          <button key={p.id} onClick={() => setPlan(p.id)} aria-pressed={plan === p.id} className="rounded-2xl border p-4 text-left transition" style={{ borderColor: plan === p.id ? "var(--gold)" : "var(--line-2)", background: plan === p.id ? "var(--gold-soft)" : "var(--paper-2)", boxShadow: plan === p.id ? "0 0 0 3px color-mix(in srgb, var(--gold) 25%, transparent)" : "none" }}>
            <div className="flex items-baseline justify-between gap-2"><span className="display text-xl">{p.name}</span>{p.id === "pro" && <span className="chip chip-gold">Popular</span>}</div>
            <p className="display tnum mt-2 text-2xl">{p.price}</p><p className="muted mt-1 text-xs">{p.detail}</p>
            <ul className="mt-3 space-y-1.5 text-xs">{p.items.map((f) => <li key={f} className="flex gap-2"><Check size={13} className="mt-0.5 flex-none" style={{ color: "var(--teal)" }} />{f}</li>)}</ul>
          </button>
        ))}
      </div>
      {plan !== "free" ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{["UPI / QR", "Card", "Net banking", "Wallet"].map((m) => <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m} className="btn btn-sm" style={method === m ? { borderColor: "var(--gold)", background: "var(--gold-soft)" } : undefined}>{m}</button>)}</div>
          {method === "UPI / QR" && <div className="mx-auto mt-5 grid w-36 place-items-center rounded-2xl bg-white p-3" style={{ border: "4px solid #1b1630" }}><div className="qr-pattern h-24 w-24" /><p className="mt-1 text-[10px] font-bold text-[#1b1630]">planodyssey.demo</p></div>}
          <div className="muted mt-5 flex items-center justify-between text-xs font-bold"><span>Demo checkout expires</span><span style={{ color: "var(--rose)" }}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span></div>
          <button onClick={onPaid} disabled={seconds === 0} className="btn btn-gold btn-block mt-4"><TicketCheck size={16} />Activate demo subscription</button>
        </>
      ) : <button onClick={onClose} className="btn btn-primary btn-block mt-6">Continue on Free</button>}
    </ModalShell>
  );
}

function CreatePlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: (plan: Partial<PlannerState>) => void }) {
  const [form, setForm] = useState({ eventName: "", eventType: "Wedding", eventDate: "", budget: "16000", confirmedGuests: "80", unsureGuests: "20", location: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ summary: string; budgetAdvice: string; recommendations: string[]; risks: string[]; categories: { label: string; amount: number }[]; milestones: { title: string; date: string; description: string }[]; completionWish: string } | null>(null);
  const update = (key: keyof typeof form, value: string) => setForm((c) => ({ ...c, [key]: value }));
  const submit = async () => {
    if (loading) return;
    if (!form.eventName.trim() || !form.eventDate || !form.location.trim()) return setError("Add an event name, date and place to continue.");
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, budget: Number(form.budget), confirmedGuests: Number(form.confirmedGuests), unsureGuests: Number(form.unsureGuests) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create the plan.");
      setResult(data.plan);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create the plan."); } finally { setLoading(false); }
  };
  if (result) {
    const apply = () => onCreated({
      eventName: form.eventName, eventType: form.eventType, eventDate: form.eventDate, location: form.location, budget: Number(form.budget), guests: Number(form.confirmedGuests) + Number(form.unsureGuests),
      planValidated: true, planRisks: result.risks, completionWish: result.completionWish,
      milestones: result.milestones.length ? result.milestones.map((m, i): Milestone => ({ id: `ai-milestone-${i}`, title: m.title, date: m.date, description: m.description, status: i === 0 ? "active" : "upcoming" })) : undefined,
      categories: result.categories.map((c, i): BudgetCategory => ({ id: `ai-${i}`, label: c.label, amount: Math.round(c.amount), color: ["#5b3a8c", "#1d8a84", "#e9a23b", "#c4476a", "#4f7cc4"][i % 5], icon: ["building", "utensils", "sparkles", "camera", "music"][i % 5] }))
    });
    return (
      <ModalShell title="Your plan is ready" onClose={onClose} wide>
        <div className="mt-5 rounded-2xl p-4 text-sm leading-6" style={{ background: "var(--plum-soft)" }}><Sparkles size={17} className="mb-2" style={{ color: "var(--plum)" }} />{result.summary}</div>
        <h3 className="mt-5 text-sm font-bold">Money strategy</h3><p className="muted mt-2 text-sm leading-6">{result.budgetAdvice}</p>
        <h3 className="mt-5 text-sm font-bold">Suggested allocation</h3>
        <ul className="mt-2 space-y-2 text-sm">{result.categories.map((c) => <li key={c.label} className="flex justify-between gap-4"><span className="muted">{c.label}</span><strong className="tnum">{formatCurrency(c.amount)}</strong></li>)}</ul>
        <h3 className="mt-5 text-sm font-bold">Timeline</h3>
        {result.milestones.length ? <ul className="mt-2 space-y-2 text-sm leading-6">{result.milestones.map((m) => <li key={`${m.title}-${m.date}`}><CalendarDays size={14} className="mr-2 inline" style={{ color: "var(--gold-deep)" }} /><strong>{m.date}:</strong> <span className="muted">{m.title}</span></li>)}</ul> : <p className="muted mt-2 text-sm">No milestones returned; a standard date-based timeline will be generated.</p>}
        <h3 className="mt-5 text-sm font-bold">Location recommendations</h3>
        {result.recommendations.length ? <ul className="mt-2 space-y-2 text-sm leading-6">{result.recommendations.map((r) => <li key={r}><Check size={14} className="mr-2 inline" style={{ color: "var(--teal)" }} /><span className="muted">{r}</span></li>)}</ul> : <p className="muted mt-2 text-sm">No location recommendations were returned.</p>}
        {result.risks?.length > 0 && <><h3 className="mt-5 text-sm font-bold" style={{ color: "var(--rose)" }}>Risks to verify</h3><ul className="mt-2 space-y-2 text-sm leading-6" style={{ color: "var(--rose)" }}>{result.risks.map((r) => <li key={r}>• {r}</li>)}</ul></>}
        <button onClick={apply} className="btn btn-gold btn-block mt-6">Validate plan and start countdown</button>
      </ModalShell>
    );
  }
  return (
    <ModalShell title="Create a new event plan" sub="Odyssey turns your date, place, guest uncertainty and budget into a location-aware plan that protects your money." onClose={onClose}>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="label sm:col-span-2">Event name<input className="field" value={form.eventName} onChange={(e) => update("eventName", e.target.value)} placeholder="Maya's Jaipur wedding" /></label>
        <label className="label">Event type<select className="field" value={form.eventType} onChange={(e) => update("eventType", e.target.value)}>{["Wedding", "Birthday", "Community", "Corporate", "Other"].map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="label">Event date<input type="date" className="field" value={form.eventDate} onChange={(e) => update("eventDate", e.target.value)} /></label>
        <label className="label">Budget<input type="number" min="1000" className="field" value={form.budget} onChange={(e) => update("budget", e.target.value)} /></label>
        <label className="label">Confirmed guests<input type="number" min="0" className="field" value={form.confirmedGuests} onChange={(e) => update("confirmedGuests", e.target.value)} /></label>
        <label className="label">Not-sure guests<input type="number" min="0" className="field" value={form.unsureGuests} onChange={(e) => update("unsureGuests", e.target.value)} /></label>
        <label className="label sm:col-span-2">Place / city<input className="field" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Jaipur, Rajasthan" /></label>
      </div>
      {error && <p className="mt-4 rounded-xl p-3 text-xs font-semibold" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>{error}</p>}
      <button onClick={() => void submit()} disabled={loading} className="btn btn-gold btn-block mt-5">{loading ? "Odyssey is researching…" : <><Sparkles size={16} />Generate plan</>}</button>
    </ModalShell>
  );
}

function ChatModal({ onClose, onPaywall }: { onClose: () => void; onPaywall: () => void }) {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>>([]);
  const [messages, setMessages] = useState<Array<{ text: string; type: "user" | "bot" | "error" }>>([{ text: "Hi, I'm Odyssey. Ask me about budgets, vendors, guest-driven costs or date risks.", type: "bot" }]);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);
  const sendMessage = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    const nextHistory = [...history, { role: "user" as const, parts: [{ text: prompt }] }];
    setHistory(nextHistory);
    setMessages((c) => [...c, { text: prompt, type: "user" }, { text: "Odyssey is thinking…", type: "bot" }]);
    setMessage(""); setBusy(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: prompt, history }) });
      const data = await response.json() as { error?: string; answer?: string };
      if (!response.ok) throw new Error(data.error || `API request failed (${response.status})`);
      const answer = data.answer?.trim();
      if (!answer) throw new Error("No answer came back. Try another message.");
      setMessages((c) => [...c.slice(0, -1), { text: answer, type: "bot" }]);
      setHistory([...nextHistory, { role: "model", parts: [{ text: answer }] }]);
    } catch (e) {
      setHistory(history);
      setMessages((c) => [...c.slice(0, -1), { text: `Error: ${e instanceof Error ? e.message : "The request failed."}`, type: "error" }]);
    } finally { setBusy(false); }
  };
  return (
    <ModalShell title="Odyssey concierge" sub="Event money management, vendor comparisons, guest-driven costs and date or location risk checks." onClose={onClose} wide>
      <div className="inset mt-5 h-72 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((m, i) => <div key={`${i}-${m.text.slice(0, 10)}`} className={`bubble ${m.type === "user" ? "bubble-user" : m.type === "error" ? "bubble-err" : "bubble-bot"}`}>{m.text}</div>)}
        <div ref={end} />
      </div>
      {messages.length < 2 && <div className="mt-3 flex flex-wrap gap-2">{QUICK_PROMPTS.map((p) => <button key={p} className="chip chip-gold" style={{ border: 0 }} onClick={() => void sendMessage(p)}>{p}</button>)}</div>}
      <form className="mt-4" onSubmit={(e) => { e.preventDefault(); void sendMessage(message); }}>
        <textarea autoFocus disabled={busy} className="field min-h-20" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder="Ask anything about your event…" />
        <div className="mt-3 flex gap-2">
          <button type="button" className="btn flex-1" disabled={busy} onClick={() => { setHistory([]); setMessages([{ text: "New conversation started. What would you like to ask?", type: "bot" }]); }}>Clear</button>
          <button type="button" className="btn flex-1" onClick={onPaywall}>Compare plans</button>
          <button type="submit" disabled={busy || !message.trim()} className="btn btn-primary flex-1"><Send size={15} />{busy ? "Thinking…" : "Send"}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function SettingsModal({ theme, setTheme, onClose, onLogout, onReset }: { theme: "light" | "dark"; setTheme: (t: "light" | "dark") => void; onClose: () => void; onLogout: () => void; onReset: () => void }) {
  const [reminders, setReminders] = useState(true);
  return (
    <ModalShell title="Settings" onClose={onClose}>
      <div className="mt-6 space-y-3">
        <div className="inset flex items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><Sun size={18} style={{ color: "var(--gold-deep)" }} /><div><p className="text-sm font-bold">Appearance</p><p className="muted text-xs">Light or dark workspace</p></div></div><div className="tabs"><button className="tab" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Light</button><button className="tab" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Dark</button></div></div>
        <label className="inset flex cursor-pointer items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><Bell size={18} style={{ color: "var(--gold-deep)" }} /><div><p className="text-sm font-bold">Planning reminders</p><p className="muted text-xs">Weekly runway nudges</p></div></div><input type="checkbox" className="tick" checked={reminders} onChange={(e) => setReminders(e.target.checked)} /></label>
        <button onClick={onReset} className="btn btn-block justify-start"><RotateCcw size={17} />Reset guests, tasks, expenses and documents</button>
        <button onClick={onLogout} className="btn btn-danger btn-block justify-start"><LogOut size={17} />Sign out of this workspace</button>
      </div>
    </ModalShell>
  );
}

function ProfileModal({ profile, signedIn, onClose, onSignIn }: { profile: { name: string; email: string }; signedIn: boolean; onClose: () => void; onSignIn: () => void }) {
  return (
    <ModalShell title="Your profile" onClose={onClose}>
      <div className="inset mt-6 flex items-center gap-4 p-4"><div className="grid h-14 w-14 place-items-center rounded-full text-lg font-bold text-[#2a1b04]" style={{ background: "#f3b44f" }}>{initials(profile.name)}</div><div><p className="font-bold">{profile.name}</p><p className="muted mt-1 flex items-center gap-1 text-xs"><Mail size={12} />{profile.email}</p></div></div>
      {signedIn ? <div className="chip chip-teal mt-5 w-full justify-center py-3"><Check size={14} />Your profile is synced</div> : <button onClick={onSignIn} className="btn btn-primary btn-block mt-5">Sign in or register</button>}
    </ModalShell>
  );
}

function FeedbackModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  return (
    <ModalShell title="Feedback & improvements" sub="Tell the team what would make planning calmer or more powerful." onClose={onClose}>
      <textarea className="field mt-6 min-h-32" value={text} onChange={(e) => setText(e.target.value)} placeholder="I would love to…" />
      <button onClick={onDone} disabled={!text.trim()} className="btn btn-primary btn-block mt-4">Submit feedback</button>
    </ModalShell>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Contact PlanOdyssey" sub="We help with setup, vendor questions and partnership feedback." onClose={onClose}>
      <div className="mt-6 space-y-3">
        <a href="mailto:hello@planodyssey.app" className="btn btn-block justify-start"><Mail size={18} style={{ color: "var(--gold-deep)" }} />hello@planodyssey.app</a>
        <a href="tel:+911800123456" className="btn btn-block justify-start"><Phone size={18} style={{ color: "var(--gold-deep)" }} />+91 1800 123 456</a>
        <div className="btn btn-block justify-start" style={{ cursor: "default" }}><Globe2 size={18} style={{ color: "var(--gold-deep)" }} />Mon–Fri, 10:00–18:00 IST</div>
        <div className="btn btn-block justify-start" style={{ cursor: "default" }}><CircleHelp size={18} style={{ color: "var(--gold-deep)" }} />Press Ctrl K anywhere to search</div>
      </div>
    </ModalShell>
  );
}
