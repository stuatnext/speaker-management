"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BoardMeta, Speaker, SpeakerInput } from "@/lib/monday/types";
import {
  createSpeaker,
  deleteSpeaker,
  fetchBoardMeta,
  fetchSpeakers,
  updateSpeaker,
} from "@/lib/client-api";
import { CONFIRMED_STATUSES } from "@/lib/monday/board";
import { StatusBadge, TierBadge, Tracks } from "@/components/Badges";
import SpeakerFormModal from "@/components/SpeakerFormModal";

interface Filters {
  conferenceId: string;
  status: string;
  tier: string;
  track: string;
  search: string;
}

const EMPTY_FILTERS: Filters = {
  conferenceId: "",
  status: "",
  tier: "",
  track: "",
  search: "",
};

export default function HomePage() {
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  // Modal state: 'create' | Speaker (edit) | null
  const [modal, setModal] = useState<"create" | Speaker | null>(null);

  // Load board metadata once.
  useEffect(() => {
    fetchBoardMeta()
      .then(setMeta)
      .catch((e) => setError((e as Error).message));
  }, []);

  // (Re)load speakers when the conference filter changes (server-side scope).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSpeakers({ conferenceId: filters.conferenceId || undefined, limit: 500 })
      .then((page) => {
        if (!cancelled) setSpeakers(page.speakers);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters.conferenceId]);

  // Client-side filtering for the remaining facets.
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return speakers.filter((s) => {
      if (filters.status && s.status !== filters.status) return false;
      if (filters.tier && s.tier !== filters.tier) return false;
      if (filters.track && !s.tracks.includes(filters.track)) return false;
      if (q) {
        const haystack = [s.name, s.company, s.jobTitle, s.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [speakers, filters]);

  // Group filtered speakers by conference, preserving board group order.
  const grouped = useMemo(() => {
    const order = meta?.conferences.map((c) => c.id) ?? [];
    const map = new Map<string, { name: string; items: Speaker[] }>();
    for (const s of filtered) {
      const entry = map.get(s.conferenceId) ?? {
        name: s.conferenceName,
        items: [],
      };
      entry.items.push(s);
      map.set(s.conferenceId, entry);
    }
    return [...map.entries()].sort(
      (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]),
    );
  }, [filtered, meta]);

  const stats = useMemo(() => {
    const confirmed = filtered.filter(
      (s) => s.status && CONFIRMED_STATUSES.includes(s.status),
    ).length;
    const newCount = filtered.filter((s) => s.newSpeaker).length;
    return { total: filtered.length, confirmed, newCount };
  }, [filtered]);

  function patchFilter(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
  }

  async function handleCreate(input: SpeakerInput) {
    const created = await createSpeaker(input);
    setSpeakers((cur) => [created, ...cur]);
    setModal(null);
  }

  async function handleUpdate(id: string, input: SpeakerInput) {
    const updated = await updateSpeaker(id, input);
    setSpeakers((cur) => cur.map((s) => (s.id === id ? updated : s)));
    setModal(null);
  }

  async function handleDelete(speaker: Speaker) {
    if (!window.confirm(`Delete "${speaker.name}"? This removes them from the board.`)) {
      return;
    }
    const prev = speakers;
    setSpeakers((cur) => cur.filter((s) => s.id !== speaker.id));
    try {
      await deleteSpeaker(speaker.id);
    } catch (e) {
      setSpeakers(prev);
      setError((e as Error).message);
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="header-nav">
          <div>
            <h1>Speaker Management</h1>
            <p>
              {meta ? meta.boardName : "Loading…"} · synced with monday.com
            </p>
          </div>
          <Link href="/nextpredict" className="btn btn-sm">
            NEXTPredict pipeline →
          </Link>
        </div>
      </header>

      <main className="container">
        {error && <div className="notice notice-error">{error}</div>}

        <div className="stats">
          <div className="stat">
            <div className="value">{stats.total}</div>
            <div className="label">Speakers shown</div>
          </div>
          <div className="stat">
            <div className="value">{stats.confirmed}</div>
            <div className="label">Confirmed</div>
          </div>
          <div className="stat">
            <div className="value">{stats.newCount}</div>
            <div className="label">New speakers</div>
          </div>
        </div>

        <div className="toolbar">
          <div className="field">
            <label htmlFor="f-conf">Conference</label>
            <select
              id="f-conf"
              value={filters.conferenceId}
              onChange={(e) => patchFilter({ conferenceId: e.target.value })}
            >
              <option value="">All conferences</option>
              {meta?.conferences.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-status">Status</label>
            <select
              id="f-status"
              value={filters.status}
              onChange={(e) => patchFilter({ status: e.target.value })}
            >
              <option value="">Any status</option>
              {meta?.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-tier">Tier</label>
            <select
              id="f-tier"
              value={filters.tier}
              onChange={(e) => patchFilter({ tier: e.target.value })}
            >
              <option value="">Any tier</option>
              {meta?.tiers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-track">Track</label>
            <select
              id="f-track"
              value={filters.track}
              onChange={(e) => patchFilter({ track: e.target.value })}
            >
              <option value="">Any track</option>
              {meta?.tracks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-search">Search</label>
            <input
              id="f-search"
              type="text"
              placeholder="Name, company, email…"
              value={filters.search}
              onChange={(e) => patchFilter({ search: e.target.value })}
            />
          </div>

          <div className="spacer" />

          <button
            className="btn btn-primary"
            onClick={() => setModal("create")}
            disabled={!meta}
          >
            + Add speaker
          </button>
        </div>

        {loading ? (
          <div className="skeleton">Loading speakers…</div>
        ) : grouped.length === 0 ? (
          <div className="empty">No speakers match the current filters.</div>
        ) : (
          grouped.map(([confId, group]) => (
            <section key={confId} className="conference">
              <div className="conference-head">
                <h2>{group.name}</h2>
                <span className="count">{group.items.length}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Speaker</th>
                      <th>Status</th>
                      <th>Tier</th>
                      <th>Tracks</th>
                      <th>Confirmed</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="speaker-name">
                            {s.name}
                            {s.newSpeaker && (
                              <span className="tag" style={{ marginLeft: 6 }}>
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="speaker-sub">
                            {[s.jobTitle, s.company].filter(Boolean).join(" · ") ||
                              s.email ||
                              "—"}
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={s.status} />
                        </td>
                        <td>
                          <TierBadge tier={s.tier} />
                        </td>
                        <td>
                          <Tracks tracks={s.tracks} />
                        </td>
                        <td className="speaker-sub">{s.dateConfirmed ?? "—"}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="btn btn-sm"
                              onClick={() => setModal(s)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(s)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </main>

      {modal && meta && (
        <SpeakerFormModal
          meta={meta}
          speaker={modal === "create" ? undefined : modal}
          defaultConferenceId={filters.conferenceId || undefined}
          onClose={() => setModal(null)}
          onSubmit={(input) =>
            modal === "create"
              ? handleCreate(input)
              : handleUpdate(modal.id, input)
          }
        />
      )}
    </>
  );
}
