"use client";

import { useState } from "react";
import type { BoardMeta, Speaker, SpeakerInput } from "@/lib/monday/types";

interface Props {
  meta: BoardMeta;
  /** Existing speaker when editing; undefined when creating. */
  speaker?: Speaker;
  /** Pre-selected conference for new speakers. */
  defaultConferenceId?: string;
  onClose: () => void;
  onSubmit: (input: SpeakerInput) => Promise<void>;
}

export default function SpeakerFormModal({
  meta,
  speaker,
  defaultConferenceId,
  onClose,
  onSubmit,
}: Props) {
  const editing = Boolean(speaker);
  const [name, setName] = useState(speaker?.name ?? "");
  const [conferenceId, setConferenceId] = useState(
    speaker?.conferenceId ?? defaultConferenceId ?? meta.conferences[0]?.id ?? "",
  );
  const [status, setStatus] = useState(speaker?.status ?? "");
  const [tier, setTier] = useState(speaker?.tier ?? "");
  const [tracks, setTracks] = useState<string[]>(speaker?.tracks ?? []);
  const [dateConfirmed, setDateConfirmed] = useState(
    speaker?.dateConfirmed ?? "",
  );
  const [newSpeaker, setNewSpeaker] = useState(speaker?.newSpeaker ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTrack(track: string) {
    setTracks((cur) =>
      cur.includes(track) ? cur.filter((t) => t !== track) : [...cur, track],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("A speaker name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        conferenceId,
        status: status || null,
        tier: tier || null,
        tracks,
        dateConfirmed: dateConfirmed || null,
        newSpeaker,
      });
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-head">
          <h3>{editing ? "Edit speaker" : "Add speaker"}</h3>
          <button type="button" className="close-x" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="notice notice-error">{error}</div>}

          <div className="form-row">
            <label htmlFor="sp-name">Name</label>
            <input
              id="sp-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
            />
          </div>

          <div className="form-row">
            <label htmlFor="sp-conf">Conference</label>
            <select
              id="sp-conf"
              value={conferenceId}
              onChange={(e) => setConferenceId(e.target.value)}
            >
              {meta.conferences.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="sp-status">Status</label>
            <select
              id="sp-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">No status</option>
              {meta.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="sp-tier">Marketing tier</label>
            <select
              id="sp-tier"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="">—</option>
              {meta.tiers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Conference tracks</label>
            <div className="track-picker">
              {meta.tracks.map((t) => (
                <span
                  key={t}
                  className={`track-chip${tracks.includes(t) ? " selected" : ""}`}
                  onClick={() => toggleTrack(t)}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="sp-date">Date confirmed</label>
            <input
              id="sp-date"
              type="date"
              value={dateConfirmed}
              onChange={(e) => setDateConfirmed(e.target.value)}
            />
          </div>

          <div className="checkbox-row">
            <input
              id="sp-new"
              type="checkbox"
              checked={newSpeaker}
              onChange={(e) => setNewSpeaker(e.target.checked)}
            />
            <label htmlFor="sp-new" style={{ margin: 0 }}>
              New speaker
            </label>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add speaker"}
          </button>
        </div>
      </form>
    </div>
  );
}
