# PlanOdyssey — Celebration & Event Planner

A calm command center for weddings, birthdays and every celebration worth planning well.
Built for PromptWars Virtual (Hack2skill x Google), Challenge 5.

**Live demo:** https://plan-odyssey.vercel.app

## The problem
Event planning is scattered across chats, spreadsheets and memory. Budgets drift, RSVPs go
untracked and dates slip. PlanOdyssey puts budget, guests, seating, vendors, timeline and the
day-of schedule in one place, with Gemini doing the heavy thinking.

## What it does
| Area | Highlights |
| --- | --- |
| AI planning | Gemini builds a plan (budget split, risks, milestones, run of show, tasks) with dates validated against today |
| Readiness score | A 0–100 score from budget, RSVPs, vendors, checklist and milestones, with the next best action |
| Budget studio | Editable allocations, expense log, guest what-if slider, AI budget optimizer |
| Guests and seating | RSVP tracking, CSV export, auto-seat by group, table capacity checks |
| Vendors | Compare, shortlist, request quote, book, add your own |
| Day plan | AI or template run of show, editable and printable |
| Invitations | Gemini drafts in English, Hindi, Hinglish and more; send via WhatsApp |
| Google tools | Gemini for planning, chat, invitations and budget advice; Google Calendar link and .ics export |
| Weather | Live forecast within 15 days, otherwise 3-year history for the date (Open-Meteo) |
| Experience | Cinematic opening, light and dark themes, command palette (Ctrl/⌘ K), keyboard and screen-reader support |

## Architecture
```
app/page.tsx            UI (client). Plan data and extras persist in localStorage.
app/api/plans           Gemini plan generation, zod-validated in and out, rate limited
app/api/chat            Gemini concierge with plan context and today's date
app/api/weather         Open-Meteo forecast or history, rate limited
lib/schedule.ts         Keeps milestone dates between today and the event
lib/calendar.ts         .ics export and Google Calendar links (no dependencies)
lib/rate-limit.ts       Per-IP limiter for AI routes
lib/planner-engine.ts   Budget maths and starter data
```

## Quality and safety
- API keys stay on the server (`GEMINI_API_KEY` or `GOOGLE_API_KEY`); nothing secret reaches the browser.
- Every API input and every AI output is schema-validated with zod.
- AI routes are rate limited; AI output is never trusted for dates (they are re-checked server side).
- 82 automated tests (Vitest) cover budget maths, date scheduling, calendar export, the rate limiter and all three AI/weather API routes with mocked Gemini and weather responses. Run `npm test`; CI runs a type check and the tests on every push.
- Honest about uncertainty: prices, events and weather are labelled as estimates to verify.

## Run locally
```bash
npm install
echo "GEMINI_API_KEY=your_key" > .env.local
npm run dev
```

## Known limits
Guest, task and expense data lives in the browser (localStorage). A shared RSVP link would need
a database such as Firestore; that is the next planned step.
