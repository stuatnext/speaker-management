# Speaker Management

A Next.js + TypeScript web app for managing conference speakers, synced live with
the NEXT.io **Speakers Management** board on
[monday.com](https://nextdotio.monday.com/boards/2262241472).

The app is a custom UI/automation layer over the existing board — it reads and
writes board items through the monday.com GraphQL API, so the board remains the
single source of truth.

## Features

- **Browse speakers grouped by conference** (NEXT NYC 2026, NEXT Valletta 2026,
  NextPredict 2026, …), mirroring the board's groups.
- **Filter** by conference, pipeline status, marketing tier and conference track,
  plus free-text search across name, company, job title and email.
- **Full CRUD** — add, edit and delete speakers. Edits write back to monday.com:
  status, marketing tier, conference tracks, date confirmed, the "new speaker"
  flag, name and conference (group) membership.
- **At-a-glance stats** for the current view: total, confirmed and new speakers.

Contact details (company, job title, email) are **mirrored read-only** from the
linked Speaker DB board, matching how the board is structured.

## NEXTPredict 2026 tracking system

For the conference content team (Rory Credland), there's a focused, Markdown-based
tracking system for the **NEXTPredict 2026** pipeline under
[`docs/nextpredict/`](./docs/nextpredict/README.md):

- [`tracker.md`](./docs/nextpredict/tracker.md) — the live pipeline by stage,
  owner, confirmed date and recommended next action.
- [`playbook.md`](./docs/nextpredict/playbook.md) — how to secure speakers, with
  tailored angles for priority targets.
- [`email-templates.md`](./docs/nextpredict/email-templates.md) — copy-paste
  outreach emails for every pipeline stage.

Regenerate the tracker from the board any time with `npm run tracker:generate`
(requires `MONDAY_API_TOKEN`).

### Published site (GitHub Pages)

A static, read-only snapshot of the NEXTPredict pipeline is published to GitHub
Pages from the [`site/`](./site) folder via
[`.github/workflows/pages.yml`](./.github/workflows/pages.yml).

- **URL (once enabled):** https://stuatnext.github.io/speaker-management/
- **Enable once:** Repo Settings → Pages → Source → **GitHub Actions**.
- **Rebuild locally:** `node scripts/build-site.mjs` (reads `site/data.json`;
  set `MONDAY_API_TOKEN` to refresh from the live board first), then commit.
- **Refresh in CI:** run the workflow via *workflow_dispatch* with `refresh: true`
  and a `MONDAY_API_TOKEN` repository secret.

> ⚠️ **Public exposure.** GitHub Pages on this public repo is world-readable.
> The published page contains real speaker names, statuses and owners. The page
> sets `robots: noindex` to reduce search indexing, but anyone with the link can
> view it. This was explicitly confirmed by the repo owner. To take it down,
> disable Pages in repo settings.

## Getting started

### 1. Configure the monday.com API token

Create a personal API token in monday.com (Developer → My Access Tokens) with
read/write access to the Speakers Management board, then:

```bash
cp .env.example .env.local
# edit .env.local and set MONDAY_API_TOKEN
```

| Variable           | Required | Default       | Description                          |
| ------------------ | -------- | ------------- | ------------------------------------ |
| `MONDAY_API_TOKEN` | yes      | —             | monday.com personal API token        |
| `MONDAY_BOARD_ID`  | no       | `2262241472`  | Speakers Management board id          |

The token is only ever used server-side (in Next.js route handlers) and is never
exposed to the browser.

### 2. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Scripts

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start the dev server              |
| `npm run build`     | Production build                  |
| `npm start`         | Run the production build          |
| `npm run lint`      | ESLint                            |
| `npm run typecheck` | TypeScript type-check (no emit)   |

## Architecture

```
src/
  lib/monday/
    client.ts     # GraphQL fetch wrapper (server-side; reads MONDAY_API_TOKEN)
    board.ts      # Board id, column ids and label/colour maps
    types.ts      # Speaker / BoardMeta / SpeakerInput domain types
    speakers.ts   # Maps board items <-> domain model; CRUD + board metadata
  lib/
    api.ts        # Route-handler error helper
    client-api.ts # Browser fetch helpers for the app's own API
  app/
    api/board/route.ts          # GET board metadata
    api/speakers/route.ts       # GET list / POST create
    api/speakers/[id]/route.ts  # GET / PATCH / DELETE one speaker
    page.tsx                    # Dashboard (filters, table, stats)
    layout.tsx, globals.css
  components/
    Badges.tsx           # Status / tier / track badges
    SpeakerFormModal.tsx # Add / edit form
```

### Data model

Each speaker maps to one item on the board. Editable native columns:

| Field           | Board column            | Type      |
| --------------- | ----------------------- | --------- |
| Status          | `status27`              | status    |
| Marketing tier  | `tier1`                 | status    |
| Conference track| `type`                  | dropdown  |
| Date confirmed  | `text0`                 | date      |
| New speaker     | `boolean_mkyr82tx`      | checkbox  |
| Point of contact| `person`                | people    |
| Conference      | board **group**         | group     |

Company / job title / email are read-only mirrors from the Speaker DB board
(`2328106702`).

> **Note:** `create_labels_if_missing` is disabled, so new speakers can only use
> status/tier/track labels that already exist on the board.
