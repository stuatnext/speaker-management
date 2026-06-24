#!/usr/bin/env node
/**
 * Regenerate docs/nextpredict/tracker.md from the live Speakers Management board.
 *
 * Usage:
 *   MONDAY_API_TOKEN=... npm run tracker:generate
 *
 * Pulls the NextPredict 2026 group, groups speakers by pipeline stage, assigns
 * the recommended next action + email template per stage, flags likely duplicate
 * records, and writes the Markdown tracker. Monday stays the source of truth.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BOARD_ID = process.env.MONDAY_BOARD_ID ?? "2262241472";
const GROUP_ID = process.env.NEXTPREDICT_GROUP_ID ?? "group_mm2fhh6";
const OUT = join(__dirname, "..", "docs", "nextpredict", "tracker.md");

const TOKEN = process.env.MONDAY_API_TOKEN;
if (!TOKEN) {
  console.error("MONDAY_API_TOKEN is required. Export it and re-run.");
  process.exit(1);
}

// Column ids on the board (see src/lib/monday/board.ts).
const COL = { status: "status27", track: "type", date: "text0", poc: "person" };

// Pipeline stages in working order, with the action + template per stage.
const STAGES = [
  {
    key: "In Discussion",
    heading: "💬 In Discussion",
    blurb: "Warm leads mid-conversation. Goal: lock topic + date this week. **→ Template C.**",
    action: "Send close — lock topic + date (Template C).",
    match: (s) => s === "In Discussion",
  },
  {
    key: "Invited",
    heading: "✉️ Invited",
    blurb: "Asked, no response yet. Goal: a value-led nudge. **→ Template B.**",
    action: "Follow up if no reply within ~5 days (Template B).",
    match: (s) => s === "Invited",
  },
  {
    key: "Potential",
    heading: "🔭 Potential",
    blurb: "Top of funnel. Goal: research, personalise, send the first invite. **→ Template A.**",
    action: "Research + send personalised invite (Template A).",
    match: (s) => s === "Potential Speaker",
  },
  {
    key: "Confirmed",
    heading: "✅ Confirmed",
    blurb: "Locked in. Goal: confirmation + logistics, collect bio + headshot. **→ Template D.**",
    action: "Send logistics, collect bio + headshot (Template D).",
    match: (s) => s === "Confirmed Speaker" || s === "Confirmed Sales Speaker",
  },
  {
    key: "Declined",
    heading: "❌ Declined / Cancelled",
    blurb: "Out for now. Goal: log the reason, leave the door open. **→ Template E.**",
    action: "Log reason; consider re-engage next cycle (Template E).",
    match: (s) => s === "Cancelled/Declined",
  },
];

async function mondayQuery(query, variables) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: TOKEN,
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  return body.data;
}

async function fetchSpeakers() {
  const speakers = [];
  let cursor = null;
  const queryParams = {
    rules: [{ column_id: "group", compare_value: [GROUP_ID], operator: "any_of" }],
  };

  // First page.
  let data = await mondayQuery(
    `query ($boardId: [ID!], $qp: ItemsQuery) {
      boards(ids: $boardId) {
        items_page(limit: 200, query_params: $qp) {
          cursor
          items { id name column_values { id text } }
        }
      }
    }`,
    { boardId: [BOARD_ID], qp: queryParams },
  );
  let page = data.boards[0].items_page;
  collect(page.items, speakers);
  cursor = page.cursor;

  // Continuation pages.
  while (cursor) {
    data = await mondayQuery(
      `query ($cursor: String!) {
        next_items_page(cursor: $cursor, limit: 200) {
          cursor
          items { id name column_values { id text } }
        }
      }`,
      { cursor },
    );
    page = data.next_items_page;
    collect(page.items, speakers);
    cursor = page.cursor;
  }
  return speakers;
}

function collect(items, out) {
  for (const it of items) {
    const get = (id) => it.column_values.find((c) => c.id === id)?.text?.trim() || "";
    out.push({
      id: it.id,
      name: it.name,
      status: get(COL.status),
      tracks: get(COL.track),
      date: get(COL.date),
      poc: get(COL.poc) || "—",
    });
  }
}

function escapeCell(s) {
  return String(s).replace(/\|/g, "\\|");
}

function findDuplicates(speakers) {
  const byName = new Map();
  for (const s of speakers) {
    const k = s.name.toLowerCase();
    byName.set(k, (byName.get(k) || 0) + 1);
  }
  return [...byName.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

function render(speakers) {
  const today = new Date().toISOString().slice(0, 10);
  const counts = Object.fromEntries(STAGES.map((st) => [st.key, 0]));
  for (const s of speakers) {
    const st = STAGES.find((x) => x.match(s.status));
    if (st) counts[st.key]++;
  }

  const lines = [];
  lines.push("# NEXTPredict 2026 — Pipeline Tracker", "");
  lines.push(`> **Generated from the Speakers Management board on ${today}.**`);
  lines.push(
    `> Source: NextPredict 2026 group (\`${GROUP_ID}\`). Regenerate with`,
    "> `npm run tracker:generate`. Update statuses in **Monday**, not here.",
    "",
  );
  lines.push(
    `**Totals:** ${speakers.length} speakers — ` +
      `✅ ${counts.Confirmed} confirmed · 💬 ${counts["In Discussion"]} in discussion · ` +
      `✉️ ${counts.Invited} invited · 🔭 ${counts.Potential} potential · ` +
      `❌ ${counts.Declined} declined.`,
    "",
  );
  lines.push(
    "Templates referenced below live in [`email-templates.md`](./email-templates.md).",
    "",
    "See [`playbook.md`](./playbook.md) for how to secure each stage and tailored",
    "angles for priority targets.",
    "",
    "---",
    "",
  );

  for (const st of STAGES) {
    const rows = speakers.filter((s) => st.match(s.status));
    lines.push(`## ${st.heading} (${rows.length})`, "", st.blurb, "");
    if (rows.length === 0) {
      lines.push("_None._", "");
      continue;
    }
    const showDate = st.key === "Confirmed";
    lines.push(
      showDate
        ? "| ✓ | Speaker | Owner | Confirmed | Next action |"
        : "| ✓ | Speaker | Owner | Next action |",
    );
    lines.push(
      showDate ? "| --- | --- | --- | --- | --- |" : "| --- | --- | --- | --- |",
    );
    for (const s of rows) {
      const trackNote = s.tracks ? ` _(track: ${escapeCell(s.tracks)})_` : "";
      const action = st.action + trackNote;
      lines.push(
        showDate
          ? `| ☐ | ${escapeCell(s.name)} | ${escapeCell(s.poc)} | ${s.date || "—"} | ${action} |`
          : `| ☐ | ${escapeCell(s.name)} | ${escapeCell(s.poc)} | ${action} |`,
      );
    }
    lines.push("");
  }

  const dupes = findDuplicates(speakers);
  if (dupes.length) {
    lines.push("---", "", "### Data-hygiene flags", "");
    lines.push(
      "Possible duplicate records (same name more than once) — merge in Monday:",
      "",
    );
    for (const d of dupes) lines.push(`- ${d}`);
    lines.push("");
  }

  return lines.join("\n");
}

const speakers = await fetchSpeakers();
writeFileSync(OUT, render(speakers));
console.log(`Wrote ${OUT} — ${speakers.length} NEXTPredict speakers.`);
