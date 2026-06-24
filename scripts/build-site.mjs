#!/usr/bin/env node
/**
 * Build the static GitHub Pages site (site/index.html) for the NEXTPredict 2026
 * pipeline — a single self-contained page with four tabs:
 *   Pipeline (tracking) · Battle plans (per speaker) · Email templates · Method.
 *
 * Data source, in order of preference:
 *   1. Live board, if MONDAY_API_TOKEN is set (also rewrites site/data.json).
 *   2. The committed site/data.json snapshot.
 *
 * Usage:
 *   node scripts/build-site.mjs
 *   MONDAY_API_TOKEN=... node scripts/build-site.mjs   # refresh from board + build
 *
 * NOTE: published to a PUBLIC URL via GitHub Pages; contains real speaker names,
 * statuses, owners and securing strategy. Exposure confirmed by the repo owner.
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

const STAGES = [
  { key: "In Discussion", heading: "💬 In Discussion", color: "#ff6d3b", statuses: ["In Discussion"], tpl: "C",
    blurb: "Warm leads mid-conversation. Goal: lock topic + date this week.",
    action: "Send the close — lock topic + date." },
  { key: "Invited", heading: "✉️ Invited", color: "#e484bd", statuses: ["Invited"], tpl: "B",
    blurb: "Asked, no response yet. Goal: a value-led nudge.",
    action: "Follow up if no reply within ~5 days." },
  { key: "Potential", heading: "🔭 Potential", color: "#a9bee8", statuses: ["Potential Speaker"], tpl: "A",
    blurb: "Top of funnel. Goal: research, personalise, send the first invite.",
    action: "Research + send a personalised invite." },
  { key: "Confirmed", heading: "✅ Confirmed", color: "#9cd326", statuses: ["Confirmed Speaker", "Confirmed Sales Speaker"], tpl: "D",
    blurb: "Locked in. Goal: confirmation + logistics, collect bio + headshot.",
    action: "Send logistics, collect bio + headshot." },
  { key: "Declined", heading: "❌ Declined / Cancelled", color: "#bb3354", statuses: ["Cancelled/Declined"], tpl: "E",
    blurb: "Out for now. Goal: log the reason, leave the door open.",
    action: "Log the reason; consider re-engaging next cycle." },
];

const STATUS_COLORS = {
  "Potential Speaker": "#a9bee8", Invited: "#e484bd", "In Discussion": "#ff6d3b",
  "Confirmed Speaker": "#9cd326", "Confirmed Sales Speaker": "#037f4c", "Cancelled/Declined": "#bb3354",
};

// Tailored per-speaker angles for priority prediction-markets targets.
// ⚠️ Roles inferred from name + context — verify before outreach.
const PRIORITY = {
  "David Rothschild": { tag: "Keynote candidate", plan: "One of the most credible academic-practitioner voices on forecasting and event markets. Offer a headline keynote or fireside that frames the category for the whole room. Low ask, huge credibility — close now." },
  "JB Mackenzie": { tag: "Distribution angle", plan: "Represents the bridge from mainstream retail trading into event contracts — a core NEXTPredict narrative. Close on a panel/fireside on how prediction markets reach a mass audience; pair with an exchange voice for tension." },
  "Jamie Dimon": { tag: "Moonshot", plan: "Aspirational marquee fireside. Do NOT cold-email — approach only via a board-level or investor warm intro, billed months out. If unreachable, use the attempt as positioning and pivot energy to attainable exchange/VC names." },
  "Dave Ripley": { tag: "Exchange CEO", plan: "Exchanges are central to the story. Angle: 'the exchange's role in legitimising event contracts.' Offer a keynote or headline fireside — exchange CEOs value a stage that signals category leadership." },
  "Tal Cohen": { tag: "Market structure", plan: "Institutional credibility. Angle: market structure and regulation of event contracts — a serious, agenda-setting session. Offer to handle a strong moderator pairing." },
  "Christopher Perkins": { tag: "Investor lens", plan: "Investor lens on the category. Angle: 'is this an asset class?' — capital formation and institutional adoption of prediction markets. Good panel anchor." },
  "Haseeb Qureshi": { tag: "VC thesis", plan: "Sharp, quotable, press-friendly. Angle: the VC thesis on prediction markets — who wins. Excellent for a punchy fireside or as a moderator who can spar with founders." },
  "Charlie Noyes": { tag: "Market design", plan: "Deep technical-markets credibility, draws a builder audience. Angle: the plumbing — liquidity, oracles and market design. Pairs well with Haseeb for a VC duo or with an exchange operator." },
  "Steve Quirk": { tag: "Retail distribution", plan: "Mass-market distribution from the brokerage side. Angle: 'from trading app to prediction platform — what retail wants.' Accessible, relatable session for a broad audience." },
  "Alicia Crighton": { tag: "Regulated finance", plan: "Adds regulated-derivatives gravitas and balances the lineup beyond crypto. Angle: how regulated derivatives markets view event contracts. Good credibility-anchoring panel." },
  "Tarek Mansour": { tag: "Re-engage — marquee", plan: "Arguably THE category name; a declined high-value target. Log why they declined, then re-approach for next cycle with a keynote-level offer and a concrete date far enough out. Founder-to-founder ask — escalate the re-invite to a senior NEXT.io exec." },
};

const METHOD = [
  ["Lead with the audience, not the ask", "Senior people say yes to rooms. Open with who they'll be in front of and alongside — operators, exchange leaders, investors, press. Name-drop confirmed peers; social proof closes faster than flattery."],
  ["Make the first ask specific", "\"Will you speak?\" stalls. \"Would you headline a 25-minute fireside on whether event contracts go mainstream in 2026?\" converts. Propose format + topic + rough date so they can picture it."],
  ["Reduce their effort to near zero", "Offer to draft their session title and abstract, pair them with a strong moderator, and keep prep to one 30-minute call. The easier it looks, the faster the yes."],
  ["Create gentle urgency", "\"We're finalising the prediction-markets track in the next two weeks and I'd love to hold a headline slot for you.\" Real scarcity beats manufactured pressure."],
  ["Always use the warmest path in", "Cold email is the last resort for senior targets. Check for a mutual connection, a recent article/launch to reference, or an existing NEXT.io relationship first."],
  ["Follow up like a professional", "Three touches, ~4–5 days apart, each adding value (a new confirmed name, an agenda detail, a press angle). After three silent touches, mark Leave for Now and revisit next cycle."],
];

const TEMPLATES = {
  A: { name: "Template A — Initial invitation", stage: "Potential",
    subject: "Speaking invitation — NEXTPredict 2026",
    body: `Hi {{first_name}},

I'm {{sender_name}} from the content team at NEXT.io. We're building NEXTPredict 2026 ({{event_location}}, {{event_date}}) — the first serious B2B stage dedicated to prediction markets, bringing together the exchanges, investors, regulators and media defining the category.

I'd love to have you on stage. Given your work on {{specific_reason}}, I think you'd be a standout voice in a session on {{proposed_topic}} — likely a {{format}} of about {{length}} minutes. You'd be in good company: {{confirmed_peer_1}} and {{confirmed_peer_2}} are already confirmed.

We keep it easy on your side — we'll draft a session title and abstract for your sign-off, pair you with a strong moderator, and keep prep to a single short call.

Would you be open to a 15-minute chat next week to explore it?

Best,
{{sender_name}}
{{sender_title}} · {{event_url}}` },
  B: { name: "Template B — Follow-up (no reply)", stage: "Invited",
    subject: "Re: Speaking invitation — NEXTPredict 2026",
    body: `Hi {{first_name}},

Following up on my note about NEXTPredict 2026 — I know inboxes are brutal.

Quick reason to resurface it: {{new_value_hook}} (e.g. "we've just confirmed {{notable_name}}" / "the prediction-markets track is taking shape and I'd still love to hold a headline slot for you").

If you're open in principle, I'm happy to work entirely around your calendar — even a 10-minute call would let me show you the format and the lineup.

Worth a conversation?

Best,
{{sender_name}}` },
  C: { name: "Template C — Move to close", stage: "In Discussion",
    subject: "Locking your NEXTPredict slot — topic + date",
    body: `Hi {{first_name}},

Great talking — I'm excited to get you on the NEXTPredict stage. To lock it in, here's what I'm proposing:

• Session: {{proposed_topic}}
• Format: {{format}}, ~{{length}} minutes
• Date/time: {{proposed_slot}} (we have flexibility)
• Alongside: {{co_panelists_or_moderator}}

If that works, just reply "yes" and I'll send the confirmation pack (logistics + a short bio/headshot request). Happy to tweak the angle if you'd rather take it in a different direction.

We're finalising the prediction-markets track by {{deadline}}, and I'd love to have you anchored in it.

Best,
{{sender_name}}` },
  D: { name: "Template D — Confirmation & logistics", stage: "Confirmed",
    subject: "You're confirmed for NEXTPredict 2026 🎉",
    body: `Hi {{first_name}},

Delighted to have you confirmed for NEXTPredict 2026 — thank you. Here's everything in one place:

• Session: {{session_title}}
• Format: {{format}}, ~{{length}} minutes
• Date/time: {{confirmed_slot}}
• Venue: {{event_location}}

Two quick things so we can promote you:
1. A short speaker bio (50–100 words)
2. A high-res headshot

If you can send those by {{asset_deadline}}, we'll get you onto the agenda and marketing. I'll follow up closer to the date with AV details and a brief prep call.

Best,
{{sender_name}}
{{sender_title}} · {{event_url}}` },
  E: { name: "Template E — Re-engage / graceful close", stage: "Declined",
    subject: "Thanks — and a door left open for NEXTPredict",
    body: `Hi {{first_name}},

Completely understand, and thanks for considering it — timing has to be right.

If you're open to it, I'd love to keep you in mind for a headline slot at the next edition, with much more notice so it's easy to plan around. And if anything frees up before {{event_date}}, the door is wide open.

Out of interest — was it mainly timing, or would a different format have made it easier? Helps me come back with the right ask next time.

Either way, hope to share a stage down the line.

Best,
{{sender_name}}` },
};

const PERSONALISED = [
  { name: "David Rothschild — open with the keynote (close)",
    subject: "Open NEXTPredict with the keynote?",
    body: `Hi David,

Following our exchange — I'd love to go one better than a panel. Would you open NEXTPredict 2026 with a keynote that frames where prediction markets are actually heading? You're one of the few people who can set that agenda credibly for a room of operators, investors and regulators.

~20 minutes, your thesis, your framing. We'll handle everything else and build the rest of the track around it. Confirmed so far: {{confirmed_peer_1}}, {{confirmed_peer_2}}.

Can I hold the opening slot for you while we talk details?

Best,
{{sender_name}}` },
  { name: "Tarek Mansour — re-engage a declined marquee name",
    subject: "NEXTPredict 2026 — a keynote with your name on it",
    body: `Hi Tarek,

I know the timing didn't work earlier, and I respect that. But NEXTPredict is being built around exactly the category you've defined, and it feels wrong not to have you anchoring it.

So a concrete offer: a keynote fireside, {{event_date}}, billed as a headline moment — minimal prep, maximum stage. {{rory}} (who leads our content) would personally host or hand-pick the interviewer.

If there's any version of this that works for your calendar, I'll build the slot around you. Worth 15 minutes to explore?

Best,
{{sender_name}} (on behalf of {{rory}}, NEXT.io)` },
];

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const firstName = (n) => String(n).trim().split(/\s+/)[0];

async function mondayQuery(query, variables) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: process.env.MONDAY_API_TOKEN, "API-Version": "2024-10" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  return body.data;
}

async function fetchLive() {
  const COL = { status: "status27", track: "type", date: "text0", poc: "person" };
  const out = [];
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
  let data = await mondayQuery(
    `query ($b: [ID!], $qp: ItemsQuery) { boards(ids: $b) { items_page(limit: 200, query_params: $qp) { cursor items { name column_values { id text } } } } }`,
    { b: [BOARD_ID], qp: { rules: [{ column_id: "group", compare_value: [GROUP_ID], operator: "any_of" }] } },
  );
  let page = data.boards[0].items_page;
  take(page.items);
  let cursor = page.cursor;
  while (cursor) {
    data = await mondayQuery(
      `query ($c: String!) { next_items_page(cursor: $c, limit: 200) { cursor items { name column_values { id text } } } }`,
      { c: cursor },
    );
    page = data.next_items_page;
    take(page.items);
    cursor = page.cursor;
  }
  return out;
}

function badge(st) {
  return st
    ? `<span class="badge" style="background:${STATUS_COLORS[st] || "#9aa0b4"}">${esc(st)}</span>`
    : `<span class="badge muted">No status</span>`;
}
function tagList(t) {
  return t.length ? t.map((x) => `<span class="tag">${esc(x)}</span>`).join("") : `<span class="sub">—</span>`;
}

function emailBlock(id, tplKey, name) {
  const t = TEMPLATES[tplKey];
  const filled = t.body.replaceAll("{{first_name}}", firstName(name));
  return `<button class="link-btn" data-toggle="${id}">✉️ Show recommended email (${tplKey})</button>
    <div class="email" id="${id}" hidden><div class="email-subj"><strong>Subject:</strong> ${esc(t.subject)}</div><pre>${esc(filled)}</pre></div>`;
}

function render(model) {
  const { conference, generatedAt, speakers } = model;
  const counts = Object.fromEntries(STAGES.map((st) => [st.key, speakers.filter((s) => st.statuses.includes(s.status)).length]));

  // ---- Pipeline (tracking) tab ----
  const pipelineSections = STAGES.map((st) => {
    const items = speakers.filter((s) => st.statuses.includes(s.status));
    if (!items.length) return "";
    const rows = items.map((s) => `<tr>
        <td><div class="name">${esc(s.name)}${PRIORITY[s.name] ? ' <span class="star">★</span>' : ""}</div><div class="sub">${s.poc && s.poc !== "—" ? "POC: " + esc(s.poc) : "—"}</div></td>
        <td>${badge(s.status)}</td>
        <td>${tagList(s.tracks)}</td>
        <td class="sub">${esc(s.dateConfirmed) || "—"}</td>
        <td class="sub">${esc(st.action)} <em>(Template ${st.tpl})</em></td>
      </tr>`).join("\n");
    return `<section>
      <div class="sec-head" style="border-left:4px solid ${st.color}"><h2>${st.heading}</h2><span class="count">${items.length}</span></div>
      <p class="blurb">${esc(st.blurb)}</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Speaker</th><th>Status</th><th>Tracks</th><th>Confirmed</th><th>Recommended next action</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
    </section>`;
  }).join("\n");

  // ---- Battle plans tab (per speaker) ----
  let cardIdx = 0;
  const planSections = STAGES.map((st) => {
    const items = speakers.filter((s) => st.statuses.includes(s.status));
    if (!items.length) return "";
    // Priority targets first within each stage.
    items.sort((a, b) => (PRIORITY[b.name] ? 1 : 0) - (PRIORITY[a.name] ? 1 : 0));
    const cards = items.map((s) => {
      const pri = PRIORITY[s.name];
      const id = `em${cardIdx++}`;
      const planText = pri ? pri.plan : `${st.blurb} Next: ${st.action}`;
      return `<div class="card${pri ? " priority" : ""}">
        <div class="card-head">
          <div><span class="name">${esc(s.name)}</span>${pri ? ` <span class="pill">★ ${esc(pri.tag)}</span>` : ""}</div>
          ${badge(s.status)}
        </div>
        <div class="card-meta">${s.poc && s.poc !== "—" ? "Owner: " + esc(s.poc) : "Owner: —"}${s.dateConfirmed ? " · Confirmed " + esc(s.dateConfirmed) : ""}${s.tracks.length ? " · " + esc(s.tracks.join(", ")) : ""}</div>
        <p class="plan">${esc(planText)}</p>
        ${emailBlock(id, st.tpl, s.name)}
      </div>`;
    }).join("\n");
    return `<section>
      <div class="sec-head" style="border-left:4px solid ${st.color}"><h2>${st.heading}</h2><span class="count">${items.length}</span></div>
      <div class="cards">${cards}</div>
    </section>`;
  }).join("\n");

  // ---- Email templates tab ----
  const templateBlocks = Object.entries(TEMPLATES).map(([k, t]) =>
    `<div class="tpl"><h3>${esc(t.name)}</h3><div class="sub">Use at stage: ${esc(t.stage)}</div>
     <div class="email-subj"><strong>Subject:</strong> ${esc(t.subject)}</div><pre>${esc(t.body)}</pre></div>`,
  ).join("\n");
  const personalisedBlocks = PERSONALISED.map((t) =>
    `<div class="tpl"><h3>${esc(t.name)}</h3><div class="email-subj"><strong>Subject:</strong> ${esc(t.subject)}</div><pre>${esc(t.body)}</pre></div>`,
  ).join("\n");
  const mergeTable = `<table class="merge"><thead><tr><th>Field</th><th>Fill with</th></tr></thead><tbody>
    <tr><td><code>{{event_date}}</code></td><td>Event date (TBC — confirm with Rory)</td></tr>
    <tr><td><code>{{event_location}}</code></td><td>Venue / city (TBC)</td></tr>
    <tr><td><code>{{event_url}}</code></td><td>Event landing page</td></tr>
    <tr><td><code>{{sender_name}}</code> / <code>{{sender_title}}</code></td><td>Whoever owns the row</td></tr>
    <tr><td><code>{{rory}}</code></td><td>Rory Credland (senior-signer escalations)</td></tr>
    <tr><td><code>{{proposed_topic}}</code> / <code>{{format}}</code> / <code>{{length}}</code></td><td>Session specifics</td></tr>
    <tr><td><code>{{confirmed_peer_1/2}}</code></td><td>Confirmed names for social proof</td></tr>
  </tbody></table>`;

  // ---- Method tab ----
  const methodBlocks = METHOD.map((m, i) =>
    `<div class="step"><div class="step-n">${i + 1}</div><div><h3>${esc(m[0])}</h3><p>${esc(m[1])}</p></div></div>`,
  ).join("\n");

  const statCards =
    STAGES.map((st) => `<div class="stat" style="border-top:3px solid ${st.color}"><div class="v">${counts[st.key]}</div><div class="l">${st.key}</div></div>`).join("") +
    `<div class="stat" style="border-top:3px solid #4353ff"><div class="v">${speakers.length}</div><div class="l">Total</div></div>`;

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${esc(conference)} — Speaker Battle Plan</title>
<style>
  :root{--bg:#f6f7fb;--surface:#fff;--surface2:#f0f2f8;--border:#e3e6ef;--text:#1c1f2a;--muted:#6b7280;--primary:#4353ff;--radius:10px}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  header.top{background:var(--surface);border-bottom:1px solid var(--border);padding:18px 28px}
  header.top h1{margin:0;font-size:20px}header.top p{margin:4px 0 0;color:var(--muted);font-size:13px}
  .container{max-width:1100px;margin:0 auto;padding:22px 28px 64px}
  .tabs{position:sticky;top:0;z-index:10;display:flex;gap:6px;flex-wrap:wrap;background:var(--bg);padding:14px 0;margin-bottom:8px;border-bottom:1px solid var(--border)}
  .tabs button{border:1px solid var(--border);background:var(--surface);border-radius:999px;padding:7px 16px;font-size:13px;font-weight:600;cursor:pointer;color:var(--text)}
  .tabs button.active{background:var(--primary);border-color:var(--primary);color:#fff}
  .tab{display:none}.tab.active{display:block}
  .stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px}
  .stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;min-width:118px}
  .stat .v{font-size:22px;font-weight:700}.stat .l{font-size:12px;color:var(--muted)}
  section{margin-bottom:26px}
  .sec-head{display:flex;align-items:center;gap:10px;padding-left:10px;margin-bottom:6px}
  .sec-head h2{font-size:15px;margin:0}.count{font-size:12px;color:var(--muted);background:var(--surface2);padding:2px 8px;border-radius:999px}
  .blurb{margin:0 0 8px 10px;font-size:13px;color:var(--muted)}
  .table-wrap{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
  table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:10px 14px;background:var(--surface2);border-bottom:1px solid var(--border)}
  td{padding:11px 14px;border-bottom:1px solid var(--border);vertical-align:middle}tr:last-child td{border-bottom:none}
  .name{font-weight:600}.sub{font-size:12px;color:var(--muted)}.star{color:#f5a623}
  .badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap}
  .badge.muted{background:var(--surface2);color:var(--muted)}
  .tag{display:inline-block;padding:2px 7px;border-radius:6px;font-size:11px;background:var(--surface2);color:var(--muted);margin:1px 2px 1px 0}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px}
  .card.priority{border-color:#f5a623;box-shadow:0 0 0 1px #f5a62333}
  .card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px}
  .pill{display:inline-block;background:#fff3df;color:#a86b00;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600;margin-left:4px}
  .card-meta{font-size:12px;color:var(--muted);margin-bottom:8px}
  .plan{margin:0 0 10px;font-size:13px}
  .link-btn{background:none;border:none;color:var(--primary);font-weight:600;font-size:12px;cursor:pointer;padding:0}
  .email{margin-top:8px;border-top:1px dashed var(--border);padding-top:8px}
  .email-subj{font-size:12px;margin-bottom:6px}
  pre{white-space:pre-wrap;background:var(--surface2);border-radius:8px;padding:12px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;overflow-x:auto}
  .tpl{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:14px}
  .tpl h3{margin:0 0 2px;font-size:15px}
  .merge{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:18px}
  .step{display:flex;gap:14px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:10px}
  .step-n{flex:none;width:30px;height:30px;border-radius:999px;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
  .step h3{margin:0 0 3px;font-size:14px}.step p{margin:0;font-size:13px;color:var(--muted)}
  .banner{background:#fff6e5;border:1px solid #ffd591;color:#8a5a00;padding:10px 14px;border-radius:var(--radius);font-size:12px;margin-bottom:16px}
  .note{font-size:12px;color:var(--muted);margin:0 0 16px}
  footer{color:var(--muted);font-size:12px;margin-top:24px}
</style></head>
<body>
<header class="top">
  <h1>${esc(conference)} — Speaker Battle Plan</h1>
  <p>${speakers.length} speakers · static snapshot generated ${esc(generatedAt)} · NEXT.io content team</p>
</header>
<div class="container">
  <div class="banner">Static snapshot — read-only. The live source of truth is the Speakers Management board on monday.com; edit there and rebuild.</div>

  <div class="stats">${statCards}</div>

  <div class="tabs">
    <button data-tab="pipeline" class="active">📊 Pipeline</button>
    <button data-tab="plans">🎯 Battle plans</button>
    <button data-tab="emails">✉️ Email templates</button>
    <button data-tab="method">📘 Method</button>
  </div>

  <div id="pipeline" class="tab active">
    <p class="note">Every speaker by pipeline stage, with the recommended next action and email template. ★ marks a priority target.</p>
    ${pipelineSections}
  </div>

  <div id="plans" class="tab">
    <p class="note">A securing plan for every speaker. Priority targets (★) carry a tailored angle; the rest use the stage playbook. Click to reveal the recommended email, pre-filled with their first name.</p>
    ${planSections}
  </div>

  <div id="emails" class="tab">
    <p class="note">Fill the merge fields, keep it human, send from a real person. Stage → template: Potential → A · Invited → B · In Discussion → C · Confirmed → D · Declined → E.</p>
    ${mergeTable}
    ${templateBlocks}
    <h2 style="font-size:16px;margin:22px 0 10px">Personalised examples</h2>
    <p class="note">⚠️ Verify inferred roles before sending. These show tone for senior, high-value names.</p>
    ${personalisedBlocks}
  </div>

  <div id="method" class="tab">
    <p class="note">A repeatable method that works for any speaker — taking a name from Potential to on-stage.</p>
    ${methodBlocks}
  </div>

  <footer>Generated by <code>scripts/build-site.mjs</code> from <code>site/data.json</code>. ${counts.Confirmed} confirmed of ${speakers.length}. Roles/angles for priority targets are inferred — verify before outreach.</footer>
</div>
<script>
  document.querySelectorAll('.tabs button').forEach(function(b){
    b.addEventListener('click',function(){
      document.querySelectorAll('.tabs button').forEach(function(x){x.classList.remove('active');});
      document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active');
      document.getElementById(b.getAttribute('data-tab')).classList.add('active');
      window.scrollTo({top:0,behavior:'smooth'});
    });
  });
  document.querySelectorAll('[data-toggle]').forEach(function(b){
    b.addEventListener('click',function(){
      var el=document.getElementById(b.getAttribute('data-toggle'));
      el.hidden=!el.hidden;

    });
  });
</script>
</body></html>`;
}

let model;
if (process.env.MONDAY_API_TOKEN) {
  const speakers = await fetchLive();
  model = { conference: "NEXTPredict 2026", generatedAt: new Date().toISOString().slice(0, 10), source: `Speakers Management board (${GROUP_ID})`, speakers };
  writeFileSync(DATA_FILE, JSON.stringify(model, null, 2) + "\n");
  console.log(`Refreshed ${DATA_FILE} from board (${speakers.length} speakers).`);
} else {
  model = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  console.log(`Built from committed snapshot ${DATA_FILE} (${model.speakers.length} speakers).`);
}

writeFileSync(OUT_FILE, render(model));
console.log(`Wrote ${OUT_FILE}.`);
