# DealFlow — UX/UI Redesign Proposal

> Prepared for internal review. This document outlines the proposed UX and UI improvements to transform DealFlow from a collection of isolated tools into a unified, workflow-driven platform capable of managing 100+ active prospects at once.

---

## The Problem

The app has a **workflow problem, not a features problem.** Every tool exists — they just don't talk to each other. The broker is expected to manually bridge every gap.

The current UX was designed for ~10–20 active deals. At 100+ active prospects, it collapses:

- The Kanban Pipeline becomes an unusable wall of cards with no way to prioritize
- 4 pages are invisible — not reachable from the navbar at all (`/prospects`, `/activities`, `/comp-tracker`, `/alerts`)
- No signal in one tool ever triggers an action in another — zero cross-linking
- There is no concept of "what should I do right now" at scale
- `mockData.ts` is hardcoded — the broker cannot add new tenants or buildings themselves

---

## The Diagnosis in One Sentence

> The app was built around **tools (nouns)**, not **workflows (verbs)**.

A broker's job is a loop:

```
Signal → Qualify → Outreach → Track → Close → Repeat
```

Every tool serves this loop. But right now, the broker has to figure that out on their own. The app never shows them the path.

---

## Proposed Information Architecture

Restructure the entire app around the three phases of a broker's workflow:

```
DETECT → ENGAGE → CLOSE
```

### New Nav Structure

Replace the flat 7-item navbar with a **grouped, workflow-aware navigation**:

| Phase | Pages |
|---|---|
| **Detect** — Find signals | News Intel, Scoop Board, LoopNet Search, Map View |
| **Engage** — Reach out | Prospects CRM, Email Outreach, Activity Log |
| **Close** — Win deals | Pipeline, Tasks, Comp Tracker |
| **Utility** | Dashboard (home), Alerts, Settings |

Each phase group becomes a dropdown in the nav. Every currently-orphaned page gets a home. The broker always knows where they are in the workflow.

---

## The Big Swing: Prospect CRM Table View

This is the most impactful change. **At 100+ prospects, a Kanban is dead.** The broker needs a CRM-style table — think HubSpot Contacts or Airtable — as their primary interface.

### What It Looks Like

A full-page sortable, filterable data table:

| Column | Description |
|---|---|
| Company | Name + industry badge |
| Contact | Name, title, email |
| SF Need | Space requirement |
| Pipeline Stage | Color-coded current stage |
| Last Activity | Days since last touchpoint — highlights stale rows red |
| Score | AI-calculated priority score (signals + urgency + timing) |
| Signals | Active outreach reasons (lease expiry, expansion, etc.) |
| Owner | Assigned broker |

### Capabilities

- **Sort** by any column
- **Filter** by stage, industry, urgency, assigned broker, date range, signal type
- **Search** — instant filter across all 100+ rows
- **Bulk actions** — select multiple rows, then: move to stage / assign broker / trigger outreach batch / export to CSV
- **Inline quick-actions** per row — "Draft Email", "Log Call", "Move Stage", "Push to Pipeline"

### How It Relates to the Kanban

The Kanban Pipeline **stays** but changes purpose:

```
Prospect CRM Table (full book of business — 100+ rows)
       ↓  broker qualifies a prospect
Pipeline Kanban (active deals only — hot_prospect through moving_forward)
       ↓  deal closes
Won / Lost Archive
       ↓  reactivate or hunt for new signals
Back to Detect
```

The Kanban becomes the **deal execution view**, not the prospect management view. The CRM table is everything above the funnel.

---

## Cross-Linking: Building the Roads Between Tools

The most immediately impactful quick-win changes — zero new features, just connecting what already exists.

### News & Scoop Cards
- Add **"Add to Prospects"** button on every news signal and scoop card
- Pre-fills a new Prospect CRM row with: company name, signal type, source article link

### LoopNet Property Detail
- Add **"Add Tenants to Prospects"** bulk action
- Pushes all tenants in a building into the CRM table in one click

### Prospect CRM Row
- **"Draft Outreach"** → opens Email Composer pre-loaded with company context, signals, and contact info
- **"Push to Pipeline"** → creates a pipeline deal and marks the prospect as active

### Pipeline Deal Card
- **"Prep Meeting Brief"** → triggers the existing Copilot `meeting-prep` edge function
- **"Log Activity"** → opens Activity Logger pre-linked to that prospect (no manual searching)

---

## Smarter Dashboard: Action Over Analytics

The Dashboard should open as a **Today's Command Center**, not a tab collection of charts.

### Current State (Problem)
5 tabs of analytics, leaderboards, charts, and briefings — all at once, no hierarchy.

### Proposed Layout

**Top section — Priority Queue (what needs attention right now):**
- Overdue tasks — flagged urgent
- Stale prospects (14+ days no activity)
- Hot prospects with no recent outreach
- Meetings today
- Lease expirations within 90 days

**Middle section — Quick Actions (3 buttons, always visible):**
- Log Activity
- Draft Outreach
- Search Prospects

**Bottom section — Live Intel Feed:**
- New news signals (last 24 hours)
- Recent scoops from the board
- AI Daily Briefing card (expandable, spoken via ElevenLabs TTS)

The analytics content (charts, leaderboard, deal velocity, revenue forecast, pipeline breakdown) moves to a dedicated **Analytics** page — accessible from the nav but not cluttering the daily workflow.

---

## AI Copilot: Proactive, Not Passive

The Copilot already has `PAGE_CONTEXT` — it knows what page the broker is on. It just doesn't *use* that knowledge. It should surface contextual prompts automatically when opened:

| Page | Proactive Suggestion |
|---|---|
| Prospects CRM | "You have 12 prospects with no activity in 14+ days. Want me to draft a re-engagement sequence?" |
| Pipeline | "McKinsey has been in Meeting Held for 3 weeks. Here are 3 ways to advance this deal." |
| News | "This article signals a 40,000 SF expansion. 3 prospects in your CRM match this profile. Want outreach drafted?" |
| Dashboard | Spoken daily briefing card — plays via ElevenLabs TTS (already wired in) |
| Tasks | "You have 4 overdue tasks. Want me to draft follow-up emails for each?" |

The Copilot widget should also **shrink to a floating pill** when idle, expanding on click — so it doesn't occupy visual real estate on power-user pages like the CRM table.

---

## Known Technical Constraints

These are not blocking the UX, but must be addressed during implementation:

| Constraint | Impact | Phase |
|---|---|---|
| `mockData.ts` hardcodes all buildings and tenants | CRM table can only show mock data + `custom_prospects` from Supabase — no user-added tenants | Phase 4 |
| Two disconnected prospect systems (`pipeline_deals` + `custom_prospects`) with no FK | CRM unified view needs a join layer or migration | Phase 4 |
| `outcome` / `outcome_reason` written to DB but not mapped back into TS type | Won/Lost data not accessible in UI | Phase 2 |
| Pipeline bulk actions need new Supabase RPC calls | Can't batch-move prospects without backend work | Phase 2 |
| No AI prospect scoring model yet | Score column in CRM table needs an edge function | Phase 2 |

---

## Phased Rollout

### Phase 1 — Wire the Roads *(quick wins, no data migration)*
- Restructure navbar: grouped Detect / Engage / Close sections, add all missing pages
- Add cross-linking CTAs: "Add to Prospects", "Draft Outreach", "Push to Pipeline", "Log Activity"
- Redesign Dashboard as action hub with priority queue + quick actions + intel feed

### Phase 2 — Prospect CRM Table *(core feature)*
- Build CRM table view over existing data (`mockData` + `custom_prospects`)
- Sortable, filterable, searchable — all 100+ rows
- Bulk actions: stage moves, broker assignment, outreach batching
- Inline quick-actions per row
- Refocus Pipeline Kanban to active deals only

### Phase 3 — Copilot Intelligence Upgrade
- Proactive contextual suggestions per page
- Spoken daily briefing card on Dashboard
- Outreach generation triggered directly from news/scoop signals
- Copilot shrinks to floating pill when idle

### Phase 4 — Data Migration *(when scale demands it)*
- Migrate `mockData.ts` buildings and tenants into Supabase
- Unify `pipeline_deals` + `custom_prospects` into a single `prospects` table
- Full multi-broker / team support with proper ownership model

---

## Summary

| What we're fixing | How |
|---|---|
| Tools are isolated | Cross-linking CTAs between every adjacent workflow step |
| 5 pages unreachable | Grouped nav with Detect / Engage / Close sections |
| 100+ prospects unmanageable | CRM table view as primary prospect interface |
| Kanban overloaded | Scope it to active deals only |
| Dashboard is a data dump | Redesign as priority-first action hub |
| Copilot is passive | Contextual proactive prompts per page |
| No workflow visibility | Nav structure mirrors the broker's actual job |

---

*DealFlow — Built by brokers, for brokers.*
