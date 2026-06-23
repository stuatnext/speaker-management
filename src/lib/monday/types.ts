/** Domain types shared between the data-access layer and the UI. */

/** A conference / event — backed by a monday.com board group. */
export interface Conference {
  id: string;
  name: string;
}

/** An internal point of contact (monday.com user). */
export interface PointOfContact {
  id: string;
  name: string;
}

/** A speaker record — one item on the Speakers Management board. */
export interface Speaker {
  id: string;
  name: string;
  /** Group/conference id this speaker currently sits in. */
  conferenceId: string;
  conferenceName: string;
  status: string | null;
  tier: string | null;
  /** Conference tracks (dropdown supports multiple). */
  tracks: string[];
  dateConfirmed: string | null;
  newSpeaker: boolean;
  pointsOfContact: PointOfContact[];
  // Read-only details mirrored from the Speaker DB.
  company: string | null;
  jobTitle: string | null;
  email: string | null;
}

/** Board-level metadata used to populate filters and forms. */
export interface BoardMeta {
  boardId: string;
  boardName: string;
  conferences: Conference[];
  statuses: string[];
  tiers: string[];
  tracks: string[];
}

/** Fields a client may set when creating or updating a speaker. */
export interface SpeakerInput {
  name?: string;
  conferenceId?: string;
  status?: string | null;
  tier?: string | null;
  tracks?: string[];
  dateConfirmed?: string | null;
  newSpeaker?: boolean;
}
