"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BoardMeta, Speaker } from "@/lib/monday/types";
import { fetchBoardMeta, fetchSpeakers, updateSpeaker } from "@/lib/client-api";
import { NEXTPREDICT_GROUP_ID, STAGES, groupByStage } from "@/lib/nextpredict";
import { StatusBadge, Tracks } from "@/components/Badges";

const DOCS_BASE =
  "https://github.com/stuatnext/speaker-management/blob/main/docs/nextpredict";

export default function NextPredictPage() {
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  // Local-only "actioned this week" ticks (not persisted to the board).
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchBoardMeta()
      .then(setMeta)
      .catch((e) => setError((e as Error).message));

    fetchSpeakers({ conferenceId: NEXTPREDICT_GROUP_ID, limit: 500 })
      .then((page) => setSpeakers(page.speakers))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return speakers;
    return speakers.filter((s) =>
      [s.name, s.company, s.jobTitle, s.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [speakers, search]);

  const grouped = useMemo(() => groupByStage(filtered), [filtered]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const { stage, items } of groupByStage(speakers)) c[stage.key] = items.length;
    return c;
  }, [speakers]);

  const confirmedCount =
    (counts["Confirmed"] ?? 0);

  async function changeStatus(speaker: Speaker, status: string) {
    setSavingId(speaker.id);
    setError(null);
    const prev = speakers;
    // Optimistic update.
    setSpeakers((cur) =>
      cur.map((s) => (s.id === speaker.id ? { ...s, status } : s)),
    );
    try {
      await updateSpeaker(speaker.id, { status: status || null });
    } catch (e) {
      setSpeakers(prev);
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="header-nav">
          <div>
            <h1>NEXTPredict 2026 — Content Pipeline</h1>
            <p>
              {speakers.length} speakers · live from monday.com · for the
              conference content team
            </p>
          </div>
          <Link href="/" className="btn btn-sm">
            ← All conferences
          </Link>
        </div>
      </header>

      <main className="container">
        {error && <div className="notice notice-error">{error}</div>}

        <div className="stats">
          {STAGES.map((st) => (
            <div className="stat" key={st.key} style={{ borderTopColor: st.color, borderTopWidth: 3 }}>
              <div className="value">{counts[st.key] ?? 0}</div>
              <div className="label">{st.key}</div>
            </div>
          ))}
          <div className="stat" style={{ borderTopColor: "#4353ff", borderTopWidth: 3 }}>
            <div className="value">{speakers.length}</div>
            <div className="label">Total</div>
          </div>
        </div>

        <div className="doc-links">
          <span>Securing guidance:</span>
          <a href={`${DOCS_BASE}/playbook.md`} target="_blank" rel="noreferrer">
            Playbook
          </a>
          <a href={`${DOCS_BASE}/email-templates.md`} target="_blank" rel="noreferrer">
            Email templates
          </a>
          <a href={`${DOCS_BASE}/tracker.md`} target="_blank" rel="noreferrer">
            Markdown tracker
          </a>
        </div>

        <div className="toolbar">
          <div className="field">
            <label htmlFor="np-search">Search</label>
            <input
              id="np-search"
              type="text"
              placeholder="Name, company, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="skeleton">Loading NEXTPredict pipeline…</div>
        ) : grouped.length === 0 ? (
          <div className="empty">No speakers match the current search.</div>
        ) : (
          grouped.map(({ stage, items }) => (
            <section key={stage.key} className="conference">
              <div
                className="conference-head"
                style={{ borderLeft: `4px solid ${stage.color}`, paddingLeft: 10 }}
              >
                <h2>{stage.heading}</h2>
                <span className="count">{items.length}</span>
              </div>
              <p className="stage-blurb">{stage.blurb}</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}>✓</th>
                      <th>Speaker</th>
                      <th>Status (editable)</th>
                      <th>Tracks</th>
                      <th>Confirmed</th>
                      <th>Recommended next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => (
                      <tr key={s.id} className={done[s.id] ? "row-done" : undefined}>
                        <td>
                          <input
                            type="checkbox"
                            checked={Boolean(done[s.id])}
                            onChange={(e) =>
                              setDone((d) => ({ ...d, [s.id]: e.target.checked }))
                            }
                            title="Mark actioned this week (local only)"
                          />
                        </td>
                        <td>
                          <div className="speaker-name">{s.name}</div>
                          <div className="speaker-sub">
                            {[s.jobTitle, s.company].filter(Boolean).join(" · ") ||
                              (s.pointsOfContact.length
                                ? `POC: ${s.pointsOfContact.map((p) => p.name).join(", ")}`
                                : "—")}
                          </div>
                        </td>
                        <td>
                          <div className="status-cell">
                            <StatusBadge status={s.status} />
                            <select
                              aria-label={`Change status for ${s.name}`}
                              value={s.status ?? ""}
                              disabled={!meta || savingId === s.id}
                              onChange={(e) => changeStatus(s, e.target.value)}
                            >
                              <option value="">No status</option>
                              {meta?.statuses.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                            {savingId === s.id && (
                              <span className="speaker-sub">saving…</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <Tracks tracks={s.tracks} />
                        </td>
                        <td className="speaker-sub">{s.dateConfirmed ?? "—"}</td>
                        <td className="speaker-sub">{stage.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}

        <p className="footnote">
          Changing a status here writes straight back to the Speakers Management
          board. The ✓ column is a local weekly checklist and is not saved.
          {confirmedCount > 0 && ` ${confirmedCount} confirmed so far.`}
        </p>
      </main>
    </>
  );
}
