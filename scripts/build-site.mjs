#!/usr/bin/env node
/**
 * Build the static GitHub Pages site (site/index.html) for the NEXTPredict 2026
 * pipeline.
 *
 * Data source, in order of preference:
 *   1. Live board, if MONDAY_API_TOKEN is set (also rewrites site/data.json).
 *   2. The committed site/data.json snapshot.
 *
 * Usage:
 *   node scripts/build-site.mjs                 # build from site/data.json
 *   MONDAY_API_TOKEN=... node scripts/build-site.mjs   # refresh from board + build
 *
 * NOTE: this page is published to a PUBLIC URL via GitHub Pages and contains
 * real speaker names, statuses and owners. That exposure is intentional and was
 * confirmed by the repo owner.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_DIR = join(__dirname, "..", "site");
const DATA_FILE = join(SITE_DIR, "data.json");
const OUT_FILE = join(SITE_DIR, "index.html");

const BOARD_ID = process.env.MONDAY_BOARD_ID ?? "2262241472";
const GROUP_ID = process.env.NEXTPREDICT_GROUP_ID ?? "group_mm2fhh6";
const DOCS_BASE =
  "https://github.com/stuatnext/speaker-management/blob/main/docs/nextpredict";

const STAGES = [
  { key: "In Discussion", heading: "💬 In Discussion", color: "#ff6d3b", statuses: ["In Discussion"],
    blurb: "Warm leads mid-conversation. Goal: lock topic + date this week. → Template C.",
    action: "Send close — lock topic + date (Template C)." },
  { key: "Invited", heading: "✉️ Invited", color: "#e484bd", statuses: ["Invited"],
    blurb: "Asked, no response yet. Goal: a value-led nudge. → Template B.",
    action: "Follow up if no reply within ~5 days (Template B)." },
  { key: "Potential", heading: "🔭 Potential", color: "#a9bee8", statuses: ["Potential Speaker"],
    blurb: "Top of funnel. Goal: research, personalise, send the first invite. → Template A.",
    action: "Research + send personalised invite (Template A)." },
  { key: "Confirmed", heading: "✅ Confirmed", color: "#9cd326", statuses: ["Confirmed Speaker", "Confirmed Sales Speaker"],
    blurb: "Locked in. Goal: confirmation + logistics, collect bio + headshot. → Template D.",
    action: "Send logistics, collect bio + headshot (Template D)." },
  { key: "Declined", heading: "❌ Declined / Cancelled", color: "#bb3354", statuses: ["Cancelled/Declined"],
    blurb: "Out for now. Goal: log the reason, leave the door open. → Template E.",
    action: "Log reason; consider re-engage next cycle (Template E)." },
];

const STATUS_COLORS = {
  "Potential Speaker": "#a9bee8", Invited: "#e484bd", "In Discussion": "#ff6d3b",
  "Confirmed Speaker": "#9cd326", "Confirmed Sales Speaker": "#037f4c", "Cancelled/Declined": "#bb3354",
};

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function mondayQuery(query, variables) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.MONDAY_API_TOKEN,
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  return body.data;
}

async function fetchLive() {
  const COL = { status: "status27", track: "type", date: "text0", poc: "person" };
  const out = [];
  let cursor = null;
  let data = await mondayQuery(
    `query ($b: [ID!], $qp: ItemsQuery) {
      boards(ids: $b) { items_page(limit: 200, query_params: $qp) {
        cursor items { name column_values { id text } } } }
    }`,
    { b: [BOARD_ID], qp: { rules: [{ column_id: "group", compare_value: [GROUP_ID], operator: "any_of" }] } },
  );
  let page = data.boards[0].items_page;
  const take = (items) => {
    for (const it of items) {
      const g = (id) => it.column_values.find((c) => c.id === id)?.text?.trim() || "";
      out.push({
        name: it.name,
        status: g(COL.status) || null,
        tracks: g(COL.track) ? g(COL.track).split(",").map((s) => s.trim()).filter(Boolean) : [],
        dateConfirmed: g(COL.date) || null,
        poc: g(COL.poc) || "—",
      });
    }
  };
  take(page.items);
  cursor = page.cursor;
  while (cursor) {
    data = await mondayQuery(
      `query ($c: String!) { next_items_page(cursor: $c, limit: 200) {
        cursor items { name column_values { id text } } } }`,
      { c: cursor },
    );
    page = data.next_items_page;
    take(page.items);
    cursor = page.cursor;
  }
  return out;
}

function loadData() {
  return JSON.parse(readFileSync(DATA_FILE, "utf8"));
}

function render(model) {
  const { conference, generatedAt, speakers } = model;
  const counts = Object.fromEntries(
    STAGES.map((st) => [st.key, speakers.filter((s) => st.statuses.includes(s.status)).length]),
  );

  const badge = (st) =>
    st ? `<span class="badge" style="background:${STATUS_COLORS[st] || "#9aa0b4"}">${esc(st)}</span>`
       : `<span class="badge muted">No status</span>`;
  const tracks = (t) =>
    t.length ? t.map((x) => `<span class="tag">${esc(x)}</span>`).join("") : `<span class="sub">—</span>`;

  const statCards =
    STAGES.map((st) =>
      `<div class="stat" style="border-top:3px solid ${st.color}"><div class="v">${counts[st.key]}</div><div class="l">${st.key}</div></div>`,
    ).join("") +
    `<div class="stat" style="border-top:3px solid #4353ff"><div class="v">${speakers.length}</div><div class="l">Total</div></div>`;

  const sections = STAGES.map((st) => {
    const items = speakers.filter((s) => st.statuses.includes(s.status));
    if (!items.length) return "";
    const rows = items
      .map(
        (s) => `<tr>
          <td><div class="name">${esc(s.name)}</div><div class="sub">${s.poc && s.poc !== "—" ? "POC: " + esc(s.poc) : "—"}</div></td>
          <td>${badge(s.status)}</td>
          <td>${tracks(s.tracks)}</td>
          <td class="sub">${esc(s.dateConfirmed) || "—"}</td>
          <td class="sub">${esc(st.action)}</td>
        </tr>`,
      )
      .join("\n");
    return `<section>
      <div class="sec-head" style="border-left:4px solid ${st.color}"><h2>${st.heading}</h2><span class="count">${items.length}</span></div>
      <p class="blurb">${esc(st.blurb)}</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Speaker</th><th>Status</th><th>Tracks</th><th>Confirmed</th><th>Recommended next action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${esc(conference)} — Content Pipeline</title>
<style>
  :root{--bg:#f6f7fb;--surface:#fff;--surface2:#f0f2f8;--border:#e3e6ef;--text:#1c1f2a;--muted:#6b7280;--primary:#4353ff;--radius:10px}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  header.top{background:var(--surface);border-bottom:1px solid var(--border);padding:18px 28px}
  header.top h1{margin:0;font-size:20px}header.top p{margin:4px 0 0;color:var(--muted);font-size:13px}
  .container{max-width:1180px;margin:0 auto;padding:24px 28px 64px}
  .stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px}
  .stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;min-width:120px}
  .stat .v{font-size:22px;font-weight:700}.stat .l{font-size:12px;color:var(--muted)}
  .doc-links{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:18px;font-size:13px;color:var(--muted)}
  .doc-links a{font-weight:600;color:var(--primary)}
  section{margin-bottom:28px}
  .sec-head{display:flex;align-items:center;gap:10px;padding-left:10px;margin-bottom:6px}
  .sec-head h2{font-size:15px;margin:0}.count{font-size:12px;color:var(--muted);background:var(--surface2);padding:2px 8px;border-radius:999px}
  .blurb{margin:0 0 8px 10px;font-size:13px;color:var(--muted)}
  .table-wrap{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
  table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:10px 14px;background:var(--surface2);border-bottom:1px solid var(--border)}
  td{padding:11px 14px;border-bottom:1px solid var(--border);vertical-align:middle}tr:last-child td{border-bottom:none}
  .name{font-weight:600}.sub{font-size:12px;color:var(--muted)}
  .badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap}
  .badge.muted{background:var(--surface2);color:var(--muted)}
  .tag{display:inline-block;padding:2px 7px;border-radius:6px;font-size:11px;background:var(--surface2);color:var(--muted);margin:1px 2px 1px 0}
  .banner{background:#fff6e5;border:1px solid #ffd591;color:#8a5a00;padding:10px 14px;border-radius:var(--radius);font-size:12px;margin-bottom:18px}
  footer{color:var(--muted);font-size:12px;margin-top:24px}
</style></head>
<body>
<header class="top">
  <h1>${esc(conference)} — Content Pipeline</h1>
  <p>${speakers.length} speakers · static snapshot generated ${esc(generatedAt)} · NEXT.io content team</p>
</header>
<div class="container">
  <div class="banner">Static snapshot — read-only. The live source of truth is the Speakers Management board on monday.com; edit there and rebuild.</div>
  <div class="stats">${statCards}</div>
  <div class="doc-links"><span>Securing guidance:</span>
    <a href="${DOCS_BASE}/playbook.md">Playbook</a>
    <a href="${DOCS_BASE}/email-templates.md">Email templates</a>
    <a href="${DOCS_BASE}/tracker.md">Markdown tracker</a>
  </div>
  ${sections}
  <footer>Generated by <code>scripts/build-site.mjs</code> from <code>site/data.json</code>. ${counts.Confirmed} confirmed of ${speakers.length}.</footer>
</div>
</body></html>`;
}

let model;
if (process.env.MONDAY_API_TOKEN) {
  const speakers = await fetchLive();
  model = {
    conference: "NEXTPredict 2026",
    generatedAt: new Date().toISOString().slice(0, 10),
    source: `Speakers Management board (${GROUP_ID})`,
    speakers,
  };
  writeFileSync(DATA_FILE, JSON.stringify(model, null, 2) + "\n");
  console.log(`Refreshed ${DATA_FILE} from board (${speakers.length} speakers).`);
} else {
  model = loadData();
  console.log(`Built from committed snapshot ${DATA_FILE} (${model.speakers.length} speakers).`);
}

writeFileSync(OUT_FILE, render(model));
console.log(`Wrote ${OUT_FILE}.`);
