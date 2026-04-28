# Pipeline page port

Port of the new `Pipeline.html` design into your `money/` codebase. **Drop these files into your repo at the matching paths**:

```
money-port/src/pages/Pipeline.tsx                 → money/src/pages/Pipeline.tsx
money-port/src/components/pipeline/StageColumn.tsx → money/src/components/pipeline/StageColumn.tsx
money-port/src/components/pipeline/DealCard.tsx    → money/src/components/pipeline/DealCard.tsx
money-port/src/components/pipeline/PipelineStats.tsx → money/src/components/pipeline/PipelineStats.tsx
money-port/src/components/pipeline/StageMetric.tsx → money/src/components/pipeline/StageMetric.tsx (new)
money-port/src/data/pipelineData.patch.ts          → patch into money/src/data/pipelineData.ts (see notes)
```

## What changed

- **Stage colors** — each of the 7 pipeline stages now has a distinct hue (blue / violet / indigo / magenta / amber / green / muted) used for the column accent strip, count chip, value text, card hover border and pill badge. Tokens live in `pipelineData.ts` as `stageHues`.
- **Stage column** — replaced the small badge header with a card-style header: gradient top accent, name + ⋯, count + monospaced "$ value" of deals in stage.
- **Deal card** — building icon, tighter type, monospaced SF, colored stage pill, avatar stack (placeholder initials from notes/owner), context menu retained.
- **Bottom metric strip** — sparkline cards (Total Pipeline Value, Weighted Value, Active Deals, Avg Deal Size, Win Rate). Replaces the old 6-icon stat row.
- **Topbar** — title + subtitle, ⌘K-style search input, Filters / View / + New Deal buttons.
- All Supabase, dnd, drawer, sheet, touchpoints, and table-view logic is preserved.

## Notes

- 7 stages are kept (Hot Prospect → Meeting Set → Meeting Held → Moving Forward → Won → Closed → Lost). The mockup showed 5 columns; condensing the data model is a separate decision and should be a deliberate migration, not a UI port.
- Sparkline data in `PipelineStats` is computed from your real pipeline (deal-count history per stage transition isn't in the schema, so the line is a derived "smoothed pipeline trajectory" — happy to wire to a real series if you store one).
- All other pages (Tasks, Buildings, etc.) are unchanged.
