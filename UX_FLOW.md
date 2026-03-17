# DealFlow — UX Flow Diagrams

> Visual documentation of the proposed UX architecture and user journey flows.

---

## 1. Top-Level Workflow Loop

The three-phase broker workflow that drives the entire information architecture.

```mermaid
flowchart TD
    subgraph detect [" DETECT — Find Signals "]
        D1[News Intel]
        D2[Scoop Board]
        D3[LoopNet Search]
        D4[Map View]
    end

    subgraph engage [" ENGAGE — Reach Out "]
        E1[Prospects CRM]
        E2[Email Outreach]
        E3[Activity Log]
    end

    subgraph close [" CLOSE — Win Deals "]
        C1[Pipeline Kanban]
        C2[Tasks]
        C3[Comp Tracker]
    end

    detect -->|"Signal → Add to Prospects"| engage
    engage -->|"Qualified → Push to Pipeline"| close
    close -->|"Won / Lost → Hunt again"| detect
```

---

## 2. Navigation Architecture

How the new grouped navbar maps every page to a workflow phase.

```mermaid
flowchart LR
    Logo["DealFlow Logo\n(dropdown)"]
    Dashboard["Dashboard\n(home)"]
    Alerts["Alerts\n(bell icon)"]
    Settings["Settings"]

    Logo --> Dashboard
    Logo --> Settings

    subgraph detectNav ["DETECT group"]
        N1["/news — News Intel"]
        N2["/scoop — Scoop Board"]
        N3["/loopnet — LoopNet Search"]
        N4["/map — Map View"]
    end

    subgraph engageNav ["ENGAGE group"]
        E1["/prospects — Prospects CRM"]
        E2["/email-analytics — Email Outreach"]
        E3["/activities — Activity Log"]
    end

    subgraph closeNav ["CLOSE group"]
        C1["/pipeline — Pipeline Kanban"]
        C2["/tasks — Tasks"]
        C3["/comp-tracker — Comp Tracker"]
    end

    Dashboard --- detectNav
    Dashboard --- engageNav
    Dashboard --- closeNav
    Dashboard --- Alerts
```

---

## 3. Signal to Prospect Flow

How a broker turns a market signal into a tracked prospect.

```mermaid
sequenceDiagram
    actor Broker
    participant News as News / Scoop / LoopNet
    participant CRM as Prospects CRM
    participant Email as Email Composer
    participant Activity as Activity Log

    Broker->>News: Spots expansion signal or new listing
    News->>Broker: Shows "Add to Prospects" CTA
    Broker->>CRM: Clicks — prospect row pre-filled with company + signal
    Broker->>CRM: Reviews row, sets priority / SF need
    Broker->>Email: Clicks "Draft Outreach" on CRM row
    Email->>Broker: AI generates email with company context + signal
    Broker->>Email: Reviews, sends
    Email->>Activity: Auto-logs email_sent touchpoint
    Activity->>CRM: Updates "Last Activity" timestamp on row
```

---

## 4. Prospect CRM to Pipeline Flow

How a qualified prospect graduates into an active deal.

```mermaid
flowchart LR
    CRMTable["Prospects CRM Table\n100+ rows — full book of business"]

    CRMTable -->|"Broker clicks 'Push to Pipeline'"| HotProspect

    subgraph kanban ["Pipeline Kanban — active deals only"]
        HotProspect["Hot Prospect"]
        MeetingSet["Meeting Set"]
        MeetingHeld["Meeting Held"]
        MovingForward["Moving Forward"]
    end

    HotProspect --> MeetingSet
    MeetingSet --> MeetingHeld
    MeetingHeld --> MovingForward
    MovingForward --> Won["Won"]
    MovingForward --> Lost["Lost"]

    Won -->|"Reactivate similar prospects"| CRMTable
    Lost -->|"Return to prospect pool"| CRMTable
```

---

## 5. Pipeline Deal Actions Flow

What a broker can do at each stage of the Kanban.

```mermaid
flowchart TD
    subgraph card ["Pipeline Deal Card"]
        Info["Company / Contact / SF\nStage badge + last activity"]
    end

    card --> A1["Prep Meeting Brief\n→ Copilot meeting-prep function"]
    card --> A2["Draft Outreach\n→ Email Composer pre-loaded"]
    card --> A3["Log Activity\n→ Activity Log pre-linked"]
    card --> A4["Add Note\n→ Inline note on deal"]
    card --> A5["Move Stage\n→ Drag or dropdown"]
    card --> A6["Mark Won / Lost\n→ Outcome + reason captured"]
```

---

## 6. Dashboard Command Center Layout

The proposed Dashboard structure — action-first, analytics second.

```mermaid
flowchart LR
    subgraph dash ["Dashboard — Today's Command Center"]

        subgraph header ["Header Row"]
            Greeting["AI Greeting\n+ Daily Briefing audio card"]
            QuickStats["4 Stat Cards\nActivities · Prospects · Won · Tasks"]
        end

        subgraph priority ["Priority Queue — what needs action now"]
            P1["Overdue Tasks 🔴"]
            P2["Stale Prospects 14d+ 🟡"]
            P3["Hot Prospects — no outreach 🟠"]
            P4["Meetings Today 🔵"]
            P5["Lease Expirations 90d ⚠️"]
        end

        subgraph quickActions ["Quick Actions Bar"]
            Q1["Log Activity"]
            Q2["Draft Outreach"]
            Q3["Search Prospects"]
        end

        subgraph intel ["Live Intel Feed"]
            I1["New News Signals\nlast 24h"]
            I2["Recent Scoops\nfrom the board"]
        end

        subgraph analytics ["Analytics — collapsed by default"]
            AN1["Performance tab"]
            AN2["Pipeline tab"]
            AN3["Activity tab"]
            AN4["Market tab"]
        end

    end

    header --> priority
    priority --> quickActions
    quickActions --> intel
    intel --> analytics
```

---

## 7. Prospect CRM Table — Data & Actions

Column structure and available actions on each row.

```mermaid
erDiagram
    PROSPECT_ROW {
        string company
        string contact_name
        string contact_title
        string industry
        number sf_need
        string pipeline_stage
        string last_activity
        number ai_score
        string[] signals
        string assigned_broker
    }

    PROSPECT_ROW ||--o{ INLINE_ACTIONS : "per row"
    INLINE_ACTIONS {
        action draft_outreach
        action log_call
        action move_stage
        action push_to_pipeline
        action view_detail
    }

    PROSPECT_ROW ||--o{ BULK_ACTIONS : "multi-select"
    BULK_ACTIONS {
        action move_to_stage
        action assign_broker
        action send_outreach_batch
        action export_csv
    }
```

---

## 8. AI Copilot Context Awareness

How the Copilot behaves differently based on the current page.

```mermaid
flowchart LR
    Copilot["Deal Copilot\n(floating widget)"]

    Copilot -->|"/ dashboard"| CP1["Delivers spoken daily briefing\nSurfaces today's top 3 priorities"]
    Copilot -->|"/ prospects"| CP2["'12 prospects stale 14d+\nWant a re-engagement sequence?'"]
    Copilot -->|"/ pipeline"| CP3["'McKinsey in Meeting Held 3 weeks\nHere are 3 ways to advance'"]
    Copilot -->|"/ news"| CP4["'This signal matches 3 CRM prospects\nWant outreach drafted?'"]
    Copilot -->|"/ tasks"| CP5["'4 overdue tasks\nWant follow-up emails drafted?'"]
    Copilot -->|"/ activities"| CP6["'You haven't logged activity in 2 days\nWhat happened with [top prospect]?'"]
```

---

## 9. Full User Journey — New Broker Day-in-the-Life

End-to-end journey showing how all phases connect in a real workday.

```mermaid
journey
    title Broker Day-in-the-Life with DealFlow
    section Morning — Detect
      Open Dashboard: 5: Broker
      Review AI Daily Briefing: 5: Broker, Copilot
      Check Alerts for new signals: 4: Broker
      Scan News Intel for expansion signals: 5: Broker
    section Mid-Morning — Engage
      Add 3 prospects from news signals: 5: Broker
      Open Prospects CRM, filter stale rows: 4: Broker
      Draft outreach batch via AI for 5 prospects: 5: Broker, Copilot
      Log 2 call touchpoints in Activity Log: 4: Broker
    section Afternoon — Close
      Review Pipeline Kanban for active deals: 5: Broker
      Prep meeting brief for 2pm call via Copilot: 5: Broker, Copilot
      Move 1 deal from Meeting Held to Moving Forward: 5: Broker
      Close 1 deal as Won: 5: Broker
    section End of Day
      Review Tasks for tomorrow: 4: Broker
      Check Comp Tracker for new lease data: 3: Broker
      Scoop Board post about new tenant movement: 4: Broker
```

---

*DealFlow — Detect. Engage. Close.*
