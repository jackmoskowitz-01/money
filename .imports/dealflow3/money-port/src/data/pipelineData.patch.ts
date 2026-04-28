// ─── PATCH: append to money/src/data/pipelineData.ts ──────────────────────────
// Add these exports alongside the existing stageLabels / stageColors.
// They drive the new colored kanban headers, deal-card pills, and sparklines.

import type { PipelineStage } from '@/data/pipelineData';

/**
 * Per-stage hue (HSL "H S% L%"). Used in className via inline style:
 *   style={{ ['--stage-hue' as any]: stageHues[stage] }}
 * and CSS that reads `hsl(var(--stage-hue))`.
 */
export const stageHues: Record<PipelineStage, string> = {
  hot_prospect:    '213 94% 58%',  // blue
  meeting_set:     '255 88% 66%',  // violet
  meeting_held:    '230 86% 64%',  // indigo
  moving_forward:  '320 84% 64%',  // magenta
  won:             '28 92% 60%',   // amber  (in-flight contract)
  closed:          '152 70% 50%',  // green  (closed-won)
  lost:            '217 12% 48%',  // muted
};

/**
 * New tinted pill style for stage badges, replacing the flat
 * bg-primary/10 / bg-success/20 etc. Use with inline `--stage-hue`.
 *
 *   <span
 *     className={stagePillClass}
 *     style={{ ['--stage-hue' as any]: stageHues[stage] }}
 *   >
 *     {stageLabels[stage]}
 *   </span>
 */
export const stagePillClass =
  'inline-flex items-center gap-1 h-[21px] px-2 rounded-full ' +
  'text-[10.5px] font-medium whitespace-nowrap ' +
  'border bg-[hsl(var(--stage-hue)/0.08)] border-[hsl(var(--stage-hue)/0.22)] ' +
  'text-[hsl(var(--stage-hue))]';
