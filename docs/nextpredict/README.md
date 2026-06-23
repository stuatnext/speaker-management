# NEXTPredict 2026 — Speaker Tracking System

A lightweight, version-controlled tracking system for **Rory Credland** and the
conference content team to run the NEXTPredict 2026 speaker pipeline.

NEXTPredict is NEXT.io's event dedicated to **prediction markets** — the
convergence of regulated event contracts, trading, sports betting and crypto
(Kalshi, Polymarket, Robinhood, the exchanges, the VCs funding them, and the
journalists and regulators covering them). Securing the right voices on stage is
the whole game; this folder exists to make that systematic.

It mirrors the **NextPredict 2026** group on the
[Speakers Management board](https://nextdotio.monday.com/boards/2262241472)
(`group_mm2fhh6`). Monday stays the source of truth; these docs are the working
playbook on top of it.

## What's here

| File | Purpose |
| --- | --- |
| [`tracker.md`](./tracker.md) | The live pipeline — every NEXTPredict speaker by stage, owner, confirmed date, and the recommended next action. Snapshot of the board; regenerate anytime. |
| [`playbook.md`](./playbook.md) | How to secure speakers: a stage-by-stage method, plus tailored angles for the priority targets. |
| [`email-templates.md`](./email-templates.md) | Copy-paste outreach emails for every pipeline stage, with merge fields and personalised examples. |

## Pipeline at a glance

_Snapshot taken 2026-06-23 — 65 speakers in the NextPredict 2026 group._

| Stage | Count | What it means | Priority |
| --- | --- | --- | --- |
| ✅ Confirmed | 26 | Locked in — move to logistics & retention | Protect |
| 💬 In Discussion | 10 | Warm — needs a close | **Highest** |
| ✉️ Invited | 1 | Asked, awaiting reply — needs follow-up | High |
| 🔭 Potential | 25 | Identified, not yet contacted | Medium |
| ❌ Declined / Cancelled | 3 | Out for now — log reason, consider re-engage | Low |

> **Where to spend the week:** the 10 *In Discussion* and 1 *Invited* are the
> highest-leverage — they are closest to converting. Every one of those should
> have an action dated against it (see `tracker.md`).

## How Rory should use this

1. **Monday morning:** open [`tracker.md`](./tracker.md). Work top-down —
   *In Discussion* and *Invited* first. Each row has a suggested next action and
   the matching email template.
2. **Send:** grab the relevant template from
   [`email-templates.md`](./email-templates.md), fill the merge fields, send.
3. **Need an angle for a big name?** [`playbook.md`](./playbook.md) has tailored
   suggestions for the priority targets (Kalshi, the exchanges, the VCs, etc.).
4. **Update Monday**, not these files, when a status changes — then regenerate
   the tracker so it reflects reality.

## Refreshing the tracker from Monday

`tracker.md` is a generated snapshot. To pull the latest from the board:

```bash
export MONDAY_API_TOKEN=...        # token with read access to the board
npm run tracker:generate           # rewrites docs/nextpredict/tracker.md
```

The script ([`scripts/generate-tracker.mjs`](../../scripts/generate-tracker.mjs))
reads the NextPredict group live, recomputes the pipeline counts, and assigns the
recommended next action per stage. Commit the regenerated file to keep history.

## Cadence (suggested)

- **Weekly:** regenerate tracker, clear *In Discussion* and *Invited* actions,
  send 5–10 new *Potential* invites.
- **Bi-weekly:** review *Declined* for anyone worth re-engaging.
- **Monthly:** confirm all ✅ speakers still have bio + headshot collected and
  haven't gone cold.
