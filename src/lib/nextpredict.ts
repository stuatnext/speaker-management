/**
 * NEXTPredict 2026-specific configuration shared by the app view.
 *
 * Mirrors the pipeline stages used by scripts/generate-tracker.mjs so the
 * interactive view and the generated Markdown tracker tell the same story.
 */

import type { Speaker } from "./monday/types";

/** Board group id for the "NextPredict 2026" group. */
export const NEXTPREDICT_GROUP_ID = "group_mm2fhh6";

export interface Stage {
  key: string;
  heading: string;
  /** One-line guidance for the whole stage. */
  blurb: string;
  /** Recommended next action + email template for speakers in this stage. */
  action: string;
  /** Status labels that fall into this stage. */
  statuses: string[];
  /** Accent colour for the stage header. */
  color: string;
}

/** Pipeline stages in working/priority order. */
export const STAGES: Stage[] = [
  {
    key: "In Discussion",
    heading: "💬 In Discussion",
    blurb: "Warm leads mid-conversation. Goal: lock topic + date this week. → Template C.",
    action: "Send close — lock topic + date (Template C).",
    statuses: ["In Discussion"],
    color: "#ff6d3b",
  },
  {
    key: "Invited",
    heading: "✉️ Invited",
    blurb: "Asked, no response yet. Goal: a value-led nudge. → Template B.",
    action: "Follow up if no reply within ~5 days (Template B).",
    statuses: ["Invited"],
    color: "#e484bd",
  },
  {
    key: "Potential",
    heading: "🔭 Potential",
    blurb: "Top of funnel. Goal: research, personalise, send the first invite. → Template A.",
    action: "Research + send personalised invite (Template A).",
    statuses: ["Potential Speaker"],
    color: "#a9bee8",
  },
  {
    key: "Confirmed",
    heading: "✅ Confirmed",
    blurb: "Locked in. Goal: confirmation + logistics, collect bio + headshot. → Template D.",
    action: "Send logistics, collect bio + headshot (Template D).",
    statuses: ["Confirmed Speaker", "Confirmed Sales Speaker"],
    color: "#9cd326",
  },
  {
    key: "Declined",
    heading: "❌ Declined / Cancelled",
    blurb: "Out for now. Goal: log the reason, leave the door open. → Template E.",
    action: "Log reason; consider re-engage next cycle (Template E).",
    statuses: ["Cancelled/Declined"],
    color: "#bb3354",
  },
];

/** Catch-all stage for any status not mapped above (e.g. ON HOLD). */
export const OTHER_STAGE: Stage = {
  key: "Other",
  heading: "🗂️ Other / Uncategorised",
  blurb: "Statuses outside the core pipeline (e.g. On Hold, Sales Prospect). Review and re-stage.",
  action: "Review status and move into the pipeline.",
  statuses: [],
  color: "#9aa0b4",
};

/** Resolve the stage a speaker belongs to from its status. */
export function stageForStatus(status: string | null): Stage {
  if (status) {
    for (const stage of STAGES) {
      if (stage.statuses.includes(status)) return stage;
    }
  }
  return OTHER_STAGE;
}

/** Bucket speakers into stages, preserving stage order. */
export function groupByStage(speakers: Speaker[]): Array<{ stage: Stage; items: Speaker[] }> {
  const all = [...STAGES, OTHER_STAGE];
  return all
    .map((stage) => ({
      stage,
      items: speakers.filter((s) => stageForStatus(s.status).key === stage.key),
    }))
    .filter((g) => g.items.length > 0);
}
