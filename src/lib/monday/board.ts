/**
 * Static configuration describing the NEXT.io "Speakers Management" board.
 *
 * Column ids and label sets are taken from the live board schema. The native
 * (editable) columns live on this board; contact details such as company,
 * job title and email are mirrored read-only from the linked Speaker DB board.
 */

export const BOARD_ID = process.env.MONDAY_BOARD_ID ?? "2262241472";

/** Column ids on the Speakers Management board. */
export const COLUMNS = {
  /** People column — internal point of contact ("iGaming POC"). */
  poc: "person",
  /** Pipeline status (Potential / Invited / Confirmed / ...). */
  status: "status27",
  /** Marketing tier (Tier 1/2/3, Featured, Sponsor). */
  tier: "tier1",
  /** Conference track (dropdown, multi-select). */
  track: "type",
  /** Date the speaker was confirmed. */
  dateConfirmed: "text0",
  /** "New speaker" checkbox. */
  newSpeaker: "boolean_mkyr82tx",

  // Read-only mirror columns sourced from the linked Speaker DB board.
  company: "mirror8",
  companyType: "dup__of_company__1",
  jobTitle: "mirror5",
  email: "dup__of_job_title",
  bio: "dup__of_headshot",
} as const;

/** Editable status labels (excludes deactivated / blank entries). */
export const STATUS_LABELS = [
  "Potential Speaker",
  "Invited",
  "In Discussion",
  "Confirmed Speaker",
  "Confirmed Sales Speaker",
  "Sales Prospect",
  "ON HOLD",
  "Leave for Now",
  "Cancelled/Declined",
] as const;

/** Hex colours per status, mirroring the board for visual parity. */
export const STATUS_COLORS: Record<string, string> = {
  "Potential Speaker": "#a9bee8",
  Invited: "#e484bd",
  "In Discussion": "#ff6d3b",
  "Confirmed Speaker": "#9cd326",
  "Confirmed Sales Speaker": "#037f4c",
  "Sales Prospect": "#579bfc",
  "ON HOLD": "#007eb5",
  "Leave for Now": "#9d50dd",
  "Cancelled/Declined": "#bb3354",
};

/** Statuses that represent a locked-in speaker. */
export const CONFIRMED_STATUSES = ["Confirmed Speaker", "Confirmed Sales Speaker"];

export const TIER_LABELS = ["Tier 1", "Tier 2", "Tier 3", "Featured", "SPONSOR"] as const;

export const TIER_COLORS: Record<string, string> = {
  "Tier 1": "#fdab3d",
  "Tier 2": "#66ccff",
  "Tier 3": "#cd9282",
  Featured: "#ff5ac4",
  SPONSOR: "#037f4c",
};

/** Active conference-track dropdown labels. */
export const TRACK_LABELS = [
  "Operator",
  "Leadership",
  "Tribal",
  "RG",
  "Sports & Media",
  "Investment",
  "Marketing",
  "Personal Development",
  "Social Casino",
  "Sustainability",
  "Global Markets",
  "Tech",
  "HR Connect",
  "Hot 6",
  "Emerging Verticals",
  "Affiliate Focus",
  "Prediction Markets",
  "Focus: Crypto",
  "Start Up",
  "AI Hub",
] as const;
