/**
 * Data-access layer mapping monday.com board items to/from the `Speaker`
 * domain model. All functions run server-side only.
 */

import { mondayQuery, MondayError } from "./client";
import { BOARD_ID, COLUMNS } from "./board";
import type {
  BoardMeta,
  Conference,
  PointOfContact,
  Speaker,
  SpeakerInput,
} from "./types";

/** Shape of a column value as returned by the monday.com API. */
interface RawColumnValue {
  id: string;
  text: string | null;
  type: string;
  value: string | null;
}

interface RawItem {
  id: string;
  name: string;
  group: { id: string; title: string } | null;
  column_values: RawColumnValue[];
}

function columnText(item: RawItem, columnId: string): string | null {
  const col = item.column_values.find((c) => c.id === columnId);
  const text = col?.text?.trim();
  return text ? text : null;
}

/** Parse a multi-select dropdown column into individual labels. */
function dropdownLabels(item: RawItem, columnId: string): string[] {
  const text = columnText(item, columnId);
  if (!text) return [];
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePointsOfContact(item: RawItem): PointOfContact[] {
  const col = item.column_values.find((c) => c.id === COLUMNS.poc);
  if (!col?.value) return [];
  try {
    const parsed = JSON.parse(col.value) as {
      personsAndTeams?: Array<{ id: number | string; kind: string }>;
    };
    const names = (col.text ?? "").split(",").map((s) => s.trim());
    return (parsed.personsAndTeams ?? [])
      .filter((p) => p.kind === "person")
      .map((p, i) => ({ id: String(p.id), name: names[i] ?? `User ${p.id}` }));
  } catch {
    return [];
  }
}

function mapItem(item: RawItem): Speaker {
  const newSpeakerCol = item.column_values.find((c) => c.id === COLUMNS.newSpeaker);
  let newSpeaker = false;
  if (newSpeakerCol?.value) {
    try {
      newSpeaker = JSON.parse(newSpeakerCol.value)?.checked === "true";
    } catch {
      newSpeaker = false;
    }
  }

  return {
    id: item.id,
    name: item.name,
    conferenceId: item.group?.id ?? "",
    conferenceName: item.group?.title ?? "Ungrouped",
    status: columnText(item, COLUMNS.status),
    tier: columnText(item, COLUMNS.tier),
    tracks: dropdownLabels(item, COLUMNS.track),
    dateConfirmed: columnText(item, COLUMNS.dateConfirmed),
    newSpeaker,
    pointsOfContact: parsePointsOfContact(item),
    company: columnText(item, COLUMNS.company),
    jobTitle: columnText(item, COLUMNS.jobTitle),
    email: columnText(item, COLUMNS.email),
  };
}

const ITEM_FIELDS = `
  id
  name
  group { id title }
  column_values { id text type value }
`;

/** Fetch board metadata: name, groups (conferences) and label sets. */
export async function getBoardMeta(): Promise<BoardMeta> {
  const data = await mondayQuery<{
    boards: Array<{
      id: string;
      name: string;
      groups: Array<{ id: string; title: string }>;
      columns: Array<{ id: string; settings_str: string }>;
    }>;
  }>(
    `query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        id
        name
        groups { id title }
        columns { id settings_str }
      }
    }`,
    { boardId: [BOARD_ID] },
  );

  const board = data.boards[0];
  if (!board) throw new MondayError("Speakers board not found", 404);

  const labelsFor = (columnId: string): string[] => {
    const col = board.columns.find((c) => c.id === columnId);
    if (!col?.settings_str) return [];
    try {
      const settings = JSON.parse(col.settings_str);
      const labels = settings.labels;
      if (Array.isArray(labels)) {
        // Dropdown columns: array of { id, label }.
        return labels.map((l: { label: string }) => l.label).filter(Boolean);
      }
      // Status columns: object map of index -> label.
      return Object.values(labels ?? {})
        .map((l) => String(l))
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  return {
    boardId: board.id,
    boardName: board.name,
    conferences: board.groups.map((g) => ({ id: g.id, name: g.title })),
    statuses: labelsFor(COLUMNS.status),
    tiers: labelsFor(COLUMNS.tier),
    tracks: labelsFor(COLUMNS.track),
  };
}

export interface ListSpeakersOptions {
  conferenceId?: string;
  limit?: number;
  cursor?: string;
}

export interface SpeakerPage {
  speakers: Speaker[];
  cursor: string | null;
}

/** List speakers, optionally scoped to a single conference (group). */
export async function listSpeakers(
  options: ListSpeakersOptions = {},
): Promise<SpeakerPage> {
  const limit = Math.min(options.limit ?? 100, 500);

  // Paginated cursor continuation.
  if (options.cursor) {
    const data = await mondayQuery<{
      next_items_page: { cursor: string | null; items: RawItem[] };
    }>(
      `query ($cursor: String!, $limit: Int!) {
        next_items_page(cursor: $cursor, limit: $limit) { cursor items { ${ITEM_FIELDS} } }
      }`,
      { cursor: options.cursor, limit },
    );
    return {
      speakers: data.next_items_page.items.map(mapItem),
      cursor: data.next_items_page.cursor,
    };
  }

  const queryParams = options.conferenceId
    ? { rules: [{ column_id: "group", compare_value: [options.conferenceId], operator: "any_of" }] }
    : undefined;

  const data = await mondayQuery<{
    boards: Array<{ items_page: { cursor: string | null; items: RawItem[] } }>;
  }>(
    `query ($boardId: [ID!], $limit: Int!, $queryParams: ItemsQuery) {
      boards(ids: $boardId) {
        items_page(limit: $limit, query_params: $queryParams) {
          cursor
          items { ${ITEM_FIELDS} }
        }
      }
    }`,
    { boardId: [BOARD_ID], limit, queryParams },
  );

  const page = data.boards[0]?.items_page;
  return {
    speakers: page?.items.map(mapItem) ?? [],
    cursor: page?.cursor ?? null,
  };
}

/** Fetch a single speaker by item id. */
export async function getSpeaker(id: string): Promise<Speaker | null> {
  const data = await mondayQuery<{ items: RawItem[] }>(
    `query ($ids: [ID!]) { items(ids: $ids) { ${ITEM_FIELDS} } }`,
    { ids: [id] },
  );
  const item = data.items[0];
  return item ? mapItem(item) : null;
}

/** Build a monday.com `column_values` JSON payload from speaker input. */
function buildColumnValues(input: SpeakerInput): Record<string, unknown> {
  const cols: Record<string, unknown> = {};

  if (input.status !== undefined) {
    cols[COLUMNS.status] = input.status ? { label: input.status } : {};
  }
  if (input.tier !== undefined) {
    cols[COLUMNS.tier] = input.tier ? { label: input.tier } : {};
  }
  if (input.tracks !== undefined) {
    cols[COLUMNS.track] = { labels: input.tracks };
  }
  if (input.dateConfirmed !== undefined) {
    cols[COLUMNS.dateConfirmed] = input.dateConfirmed ?? "";
  }
  if (input.newSpeaker !== undefined) {
    cols[COLUMNS.newSpeaker] = { checked: input.newSpeaker ? "true" : "false" };
  }
  return cols;
}

/** Create a new speaker item in the given conference group. */
export async function createSpeaker(input: SpeakerInput): Promise<Speaker> {
  if (!input.name?.trim()) {
    throw new MondayError("A speaker name is required", 400);
  }

  const columnValues = buildColumnValues(input);
  const data = await mondayQuery<{ create_item: RawItem }>(
    `mutation ($boardId: ID!, $groupId: String, $name: String!, $cols: JSON) {
      create_item(
        board_id: $boardId
        group_id: $groupId
        item_name: $name
        column_values: $cols
        create_labels_if_missing: false
      ) { ${ITEM_FIELDS} }
    }`,
    {
      boardId: BOARD_ID,
      groupId: input.conferenceId || null,
      name: input.name.trim(),
      cols: JSON.stringify(columnValues),
    },
  );

  return mapItem(data.create_item);
}

/** Update an existing speaker's column values and/or name and group. */
export async function updateSpeaker(
  id: string,
  input: SpeakerInput,
): Promise<Speaker> {
  // Name changes use a dedicated mutation.
  if (input.name !== undefined && input.name.trim()) {
    await mondayQuery(
      `mutation ($boardId: ID!, $itemId: ID!, $value: JSON!) {
        change_column_value(board_id: $boardId, item_id: $itemId, column_id: "name", value: $value) { id }
      }`,
      { boardId: BOARD_ID, itemId: id, value: JSON.stringify(input.name.trim()) },
    );
  }

  // Move to a different conference group if requested.
  if (input.conferenceId !== undefined && input.conferenceId) {
    await mondayQuery(
      `mutation ($itemId: ID!, $groupId: String!) {
        move_item_to_group(item_id: $itemId, group_id: $groupId) { id }
      }`,
      { itemId: id, groupId: input.conferenceId },
    );
  }

  const columnValues = buildColumnValues(input);
  if (Object.keys(columnValues).length > 0) {
    await mondayQuery(
      `mutation ($boardId: ID!, $itemId: ID!, $cols: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $cols) { id }
      }`,
      { boardId: BOARD_ID, itemId: id, cols: JSON.stringify(columnValues) },
    );
  }

  const updated = await getSpeaker(id);
  if (!updated) throw new MondayError("Speaker not found after update", 404);
  return updated;
}

/** Delete a speaker item. */
export async function deleteSpeaker(id: string): Promise<void> {
  await mondayQuery(
    `mutation ($itemId: ID!) { delete_item(item_id: $itemId) { id } }`,
    { itemId: id },
  );
}
