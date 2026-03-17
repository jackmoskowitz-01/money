# DealFlow — AI-Powered CRE Intelligence Platform

> Built by brokers, for brokers. DealFlow combines real-time market intelligence, AI-driven outreach, and deal management into one platform — so you close more and grind less.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Pages & Routes](#pages--routes)
- [Supabase Edge Functions](#supabase-edge-functions)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Testing](#testing)

---

## Overview

DealFlow is a full-stack SaaS platform for **commercial real estate (CRE) brokers**. It replaces the sprawl of spreadsheets, manual research, and generic cold emails with an AI-first workflow:

1. **Detect** — AI monitors news, lease expirations, and market shifts to surface actionable signals before the competition.
2. **Engage** — Generate research-backed, personalized outreach in the broker's own voice. Smart sequences nurture prospects automatically.
3. **Close** — Track every deal through the pipeline. The AI Copilot prepares meeting briefs, handles objections, and keeps deals moving.

---

## Features

### Dashboard
Central command center with tabbed views across:
- **Performance** — Broker leaderboard, AI daily briefing, deal velocity, revenue forecast, and today's prioritized focus items.
- **Pipeline** — Funnel breakdown, stage distribution pie chart, and win rate by industry.
- **Activity** — Real-time activity feed with email/call/meeting breakdowns and pending tasks.
- **Market** — Submarket trends and meetings overview.
- **Critical Dates** — Lease expiration tracking and upcoming tenant action dates.

### Scoop Board
A shared intelligence feed where brokers post             and browse market "scoops" — deal signals, tenant moves, and market intel. Includes category badges, filtering, and a scoop creation form.

### Deal Copilot
An AI strategist with full context of every deal, prospect, and market trend. Brokers can ask it anything — comp analysis, commission calculations, objection handling, or meeting prep. Supports:
- Text and voice input (ElevenLabs TTS + Scribe)
- File uploads (pitch decks, stacking plans, lease abstracts)
- Conversation history
- Follow-up suggestions

### Smart Outreach & Email Composer
- AI-generated, hyper-personalized cold emails that mirror the broker's writing style
- Email refinement and A/B variant generation
- Multi-step sequence support
- Email templates library

### Email Analytics
- Response rate tracking by template, tone, and industry
- AI-powered reply classification (sentiment, intent)
- Email thread management

### Pipeline Management
Kanban-style deal tracking with:
- Drag-and-drop stage progression
- Auto-logged touchpoints and activity history
- Deal velocity tracking
- Stale prospect alerts (14+ days without activity)
- Broker assignment

### Prospects & LoopNet Search
- Search commercial properties via LoopNet integration
- Prospect detail views with tenant data
- Custom prospect creation and management
- ZoomInfo enrichment (company + people data via Apify)
- Map view of properties (react-leaflet)

### News Intelligence
- Real-time CRE market news scanning
- Company-specific news scraping
- Auto-detection of expansion, relocation, and funding signals
- Outreach-ready talking points generated from news

### Comp Tracker
Track comparable sales and lease transactions in target submarkets.

### Tasks
Full task management system with:
- Due date tracking and overdue alerts
- Task comments
- Auto-completion logic
- Linked to tenants, buildings, and pipeline deals

### Activity Logger
Log and view all broker touchpoints — emails sent, calls made, meetings held — linked to prospects and buildings.

### Alerts
Configurable notification system for deal events, critical dates, and market signals.

### Critical Dates Tracker
AI extracts critical lease dates from uploaded abstracts and stacking plans, flags upcoming expirations, and surfaces renewal/expansion opportunities.

### Settings & Auth
- Supabase Auth (email/password + password reset)
- User profile and preferences
- Theme support (light/dark via next-themes)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS + shadcn/ui + Radix UI |
| Animations | Framer Motion |
| Routing | React Router v6 |
| State / Data Fetching | TanStack React Query |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Maps | React Leaflet |
| Backend / DB | Supabase (Postgres + Realtime + Auth) |
| Edge Functions | Supabase Deno functions |
| AI / LLM | OpenAI (via edge functions) |
| Voice | ElevenLabs (TTS + Scribe) |
| Enrichment | ZoomInfo via Apify |
| Property Search | LoopNet API |
| Export | ExcelJS, docx, pptxgenjs |
| Testing | Vitest + Testing Library + Playwright |

---

## Project Structure

```
market-scoop-hub/
├── src/
│   ├── assets/              # Static assets (logos, images)
│   ├── components/          # Reusable UI components
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── copilot/         # Deal Copilot sub-components
│   │   └── scoop/           # Scoop Board sub-components
│   ├── contexts/            # React context providers (Auth)
│   ├── data/                # Static mock data and templates
│   ├── hooks/               # Custom React hooks
│   ├── integrations/
│   │   └── supabase/        # Supabase client + generated types
│   ├── lib/                 # Utility functions and export helpers
│   └── pages/               # Route-level page components
├── supabase/
│   ├── config.toml          # Supabase project config
│   ├── functions/           # Deno edge functions
│   └── migrations/          # Postgres migration files
├── public/
├── package.json
├── tailwind.config.ts
├── vite.config.ts (via vitest.config.ts)
└── tsconfig.json
```

---

## Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Public marketing page with features, testimonials, demo form |
| `/auth` | Auth | Sign in / sign up |
| `/reset-password` | ResetPassword | Password reset flow |
| `/dashboard` | Dashboard | Main broker command center |
| `/pipeline` | Pipeline | Kanban deal pipeline |
| `/prospects` | Prospects | Prospect list and management |
| `/prospects/:id` | CustomProspectDetail | Individual prospect detail |
| `/loopnet` | LoopNetSearch | LoopNet property search |
| `/loopnet/:id` | LoopNetDetail | Individual property detail |
| `/tenant/:id` | TenantDetail | Tenant profile and lease data |
| `/scoops` | ScoopBoard | Market intelligence feed |
| `/news` | News | Market news and signals |
| `/email-analytics` | EmailAnalytics | Outreach performance analytics |
| `/comp-tracker` | CompTracker | Comparable transactions tracker |
| `/tasks` | Tasks | Task management |
| `/activities` | ActivityLogger | Activity log |
| `/alerts` | Alerts | Notification alerts |
| `/map` | MapView | Geographic property map |
| `/settings` | Settings | User settings |

---

## Supabase Edge Functions

All edge functions live in `supabase/functions/` and run on Deno. JWT verification is disabled on all functions (public-facing AI endpoints).

| Function | Purpose |
|---|---|
| `deal-copilot` | Core AI copilot — answers broker questions with full deal context |
| `smart-outreach` | Generates personalized outreach emails |
| `generate-outreach` | Alternate outreach generation flow |
| `generate-nonprofit-outreach` | Nonprofit-targeted outreach variant |
| `refine-email` | Refines and improves drafted emails |
| `smart-drafting` | AI email drafting from scratch |
| `classify-reply` | Classifies inbound email sentiment and intent |
| `fetch-market-news` | Fetches real-time CRE market news |
| `scan-company-news` | Scans news for a specific company |
| `intelligence-gather` | Gathers intelligence on a prospect or company |
| `enrich-prospect` | Enriches prospect data from external sources |
| `apify-zoominfo-company` | Pulls company data from ZoomInfo via Apify |
| `apify-zoominfo-people` | Pulls people/contact data from ZoomInfo via Apify |
| `apify-zoominfo-enrich` | Enriches existing records with ZoomInfo data |
| `zoominfo-webhook` | Handles ZoomInfo webhook events |
| `loopnet-search` | Searches LoopNet for commercial properties |
| `parse-stacking-plan` | Parses uploaded stacking plans with AI |
| `extract-critical-dates` | Extracts critical lease dates from documents |
| `meeting-prep` | Generates AI meeting prep briefs |
| `daily-briefing` | Generates the broker's daily AI briefing |
| `auto-digest` | Auto-digest of activity and pipeline updates |
| `territory-analysis` | Analyzes a broker's territory and submarket |
| `copilot-parse-file` | Parses files uploaded to the Copilot |
| `copilot-tts` | Text-to-speech for the Copilot (ElevenLabs) |
| `elevenlabs-scribe-token` | Issues tokens for ElevenLabs voice transcription |
| `places-autocomplete` | Google Places autocomplete for address inputs |
| `fetch-dc-buildings` | Fetches DC-area building data |

---

## Environment Variables

Create a `.env` file in the project root. Required variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Edge function secrets (set in Supabase dashboard or via `supabase secrets set`):

```
OPENAI_API_KEY
ELEVENLABS_API_KEY
APIFY_API_TOKEN
LOOPNET_API_KEY
GOOGLE_PLACES_API_KEY
```

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase CLI (for local development with edge functions)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd market-scoop-hub

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Supabase Local Dev (optional)

```sh
# Start Supabase locally
supabase start

# Apply migrations
supabase db push

# Serve edge functions locally
supabase functions serve
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build |
| `npm run build:dev` | Development mode build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest test suite once |
| `npm run test:watch` | Run Vitest in watch mode |

---

## Testing

Unit and integration tests use **Vitest** + **Testing Library**. End-to-end tests use **Playwright**.

```sh
# Run unit tests
npm run test

# Run e2e tests (requires app running)
npx playwright test
```

Test setup lives in `src/test/setup.ts`. Playwright fixture config is in `playwright-fixture.ts`.

---

© 2026 DealFlow. Real Estate Intelligence.
