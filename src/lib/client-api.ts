/** Browser-side helpers for calling the app's own API routes. */

import type {
  BoardMeta,
  Speaker,
  SpeakerInput,
} from "./monday/types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function fetchBoardMeta(): Promise<BoardMeta> {
  return fetch("/api/board").then((r) => handle<BoardMeta>(r));
}

export interface SpeakerPage {
  speakers: Speaker[];
  cursor: string | null;
}

export function fetchSpeakers(params: {
  conferenceId?: string;
  cursor?: string;
  limit?: number;
}): Promise<SpeakerPage> {
  const search = new URLSearchParams();
  if (params.conferenceId) search.set("conferenceId", params.conferenceId);
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.limit) search.set("limit", String(params.limit));
  return fetch(`/api/speakers?${search.toString()}`).then((r) =>
    handle<SpeakerPage>(r),
  );
}

export function createSpeaker(input: SpeakerInput): Promise<Speaker> {
  return fetch("/api/speakers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => handle<Speaker>(r));
}

export function updateSpeaker(
  id: string,
  input: SpeakerInput,
): Promise<Speaker> {
  return fetch(`/api/speakers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => handle<Speaker>(r));
}

export function deleteSpeaker(id: string): Promise<{ ok: boolean }> {
  return fetch(`/api/speakers/${id}`, { method: "DELETE" }).then((r) =>
    handle<{ ok: boolean }>(r),
  );
}
