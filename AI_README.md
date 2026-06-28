# AI_README.md — DK Best Ball Draft Assistant

> **Purpose of this file:** Give any AI assistant instant working context for this codebase. Read this before touching any code. Do not rely on assumptions — this file captures decisions made across many sessions that are not obvious from the code alone.

---

## What this project is

A **local-first, single-user desktop tool** for DraftKings best ball draft analysis. It has two modes:

1. **Portfolio dashboard** — import past draft history, analyze player exposure, CLV, Jaccard correlation between players, bye week patterns. Lives at `localhost:3000`.

2. **Live draft assistant** — a narrow always-on-top sidebar window that reads the DK draft board in real time via a Chrome extension and displays ranked available players with contextual flags (stack opportunities, Week 17 bring-backs, bye conflicts, correlation warnings). Lives at `localhost:3000/live-draft`.

**Nothing is deployed to the cloud.** No auth. No accounts. SQLite on the local machine only. The user is `masonkeen` on Windows 11 at `C:\Users\mason\`.

---

## Repository layout

```
C:\Users\mason\dk-portfolio-analyzer\     ← main Next.js app (also contains bridge/)
C:\Users\mason\electron-sidebar\          ← tiny Electron wrapper (~40 lines)
C:\Users\mason\extension\                 ← Chrome MV3 extension (5 files)
```

The Next.js app and the Electron sidebar are **separate projects with separate `package.json`s**. The extension is loaded unpacked in Chrome — it is never published to the Web Store.

---

## Architecture overview

```
Chrome extension (content.js)
    │  WebSocket messages (board_snapshot, on_the_clock)
    ▼
bridge/server.ts  ←── standalone Node process, port 4001
    │  reads/writes
    ▼
SQLite (prisma/dev.db)
    │  also read by
    ▼
Next.js API routes (port 3000)
    │  served to
    ▼
React UI  ←── two views: dashboard (page.tsx) and live sidebar (live-draft/page.tsx)
    │  displayed in
    ▼
Electron sidebar window  ←── always-on-top, points at localhost:3000/live-draft
```

The bridge process (`npm run bridge`, run via `tsx watch`) is the stateful hub. It holds the live draft session in memory, recomputes recommendations on every pick, and broadcasts over WebSocket. The Next.js app is stateless — it only reads from SQLite.

Both processes run together via `npm run dev:all` (uses `concurrently`).

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15, App Router, React 19, TypeScript |
| Database | SQLite via Prisma ORM |
| Styling | Tailwind CSS + inline CSS variables (no shadcn/ui in active use) |
| Charts | Recharts (installed, not heavily used yet) |
| Tables | TanStack Table v8 |
| Name fuzzy-matching | Fuse.js |
| CSV parsing | PapaParse |
| Validation | Zod (DK CSV import only) |
| Bridge runtime | Node.js + `ws` + `tsx watch` |
| Extension | Chrome MV3, plain JS (no build step) |
| Sidebar | Electron 33 |

---

## Database schema (Prisma)

**`Draft`** — one row per past draft entered. `source` is `"csv" | "json" | "live"`. Auto-saved live drafts use `"live"` and are **excluded from all exposure/analytics queries** — only `csv` and `json` drafts count toward portfolio stats.

**`Player`** — one row per player in a draft. Has both `name` (resolved canonical) and `rawName` (original abbreviated string e.g. "J. Jefferson"). Cascades delete from Draft.

**`MasterPlayer`** — the canonical player universe. Populated by importing the FantasyPros-style multi-site ADP CSV. Key fields:
- `draftkingsAdp` — primary sort key for the live assistant. Updated by importing `DK_ADP_Export.csv`.
- `underdogAdp` — from the master rankings CSV. **Never overwritten by the DK ADP import.**
- `adpDelta` — `draftkingsAdp - underdogAdp` (positive = player goes later on DK = DK value).
- `bye` — used for bye-week conflict detection.

**`TeamWeekProjection`** — Vegas data keyed by team code (e.g. `"DAL"`), NOT by player. Columns cover weeks 15–18: opponent, team total, game O/U. `week17Opp` is used to build the W17 bring-back map in the bridge.

**`PositionalValue`** — beersheets-style remaining positional value. Feature-flagged off. Set env var `POSITIONAL_VALUE_ENABLED=true` to activate.

**`RawImport`** — audit log of every CSV/JSON import with the raw data stored as JSON string.

---

## Data flow: how player data gets into the system

**Import order matters.** MasterPlayer must be populated before anything else resolves player names.

```
1. Master Rankings CSV   →  MasterPlayer (name, team, pos, bye, underdogAdp, draftkingsAdp, adpDelta)
2. DK ADP CSV            →  MasterPlayer.draftkingsAdp ONLY (does not touch underdogAdp or adpDelta)
3. Team Totals CSV       →  TeamWeekProjection (Vegas data, W17 opponent)
4. data/draft_history.json → Draft + Player (past drafts, source="json")
5. Positional Value CSV  →  PositionalValue (optional, feature-flagged)
```

**Draft history is NOT uploaded via the UI.** It lives in `data/draft_history.json` (a JSON array of draft objects). The user manually appends new draft objects to this file, then clicks "Sync draft_history.json" in the Import Data tab. The sync route deduplicates by `draftId` — re-syncing is always safe.

---

## CSV formats

### Master Rankings (`FantasyPros_2026_Overall_ADP_Rankings.csv`)
```
Rank, Player, Team, Bye, POS, BB10, RTSports, Underdog, Drafters, DraftKings, AVG
```
Parser: `src/lib/parsers/master-rankings-csv.ts`. Position strings have trailing digits stripped (`"RB23"` → `"RB"`).

### DK ADP (`DK_ADP_Export.csv`)
```
Player, Pos, Team, Bye, ADP, ADP Round, ADP LW, ADP Open, ADP LW Change, ADP Open Change
```
Parser: `src/lib/parsers/dk-adp-csv.ts`. Only `Player`, `Team`, and `ADP` columns are used. Route: `POST /api/import/dk-adp`.

### Team Totals
```
Team, W15_Opp, W15_TeamTotal, W15_OU, W16_Opp, W16_TeamTotal, W16_OU, W17_Opp, W17_TeamTotal, W17_OU, Projected_Playoff_Total, W18_Opp, W18_TeamTotal, W18_OU
```
Team column uses full nicknames ("49ers", "LA Chargers") — normalized to standard codes by `src/lib/utils/teamCode.ts`.

### Draft History JSON (`data/draft_history.json`)
Array of objects, each with shape:
```json
{
  "draftId": "20260620223846-sbdcix",
  "draftDate": "2026-06-20T22:38:46.299Z",
  "site": "DraftKings",
  "username": "masonkeen",
  "players": [
    { "playerId": "...", "roundPick": "1.9", "pick": 9, "player": "J. Jefferson", "position": "WR", "team": "MIN", "byeWeek": 6 }
  ]
}
```
The file can also contain multiple objects concatenated without an enclosing array (the parser handles this via a brace-depth splitter). `totalTeams` and `startingPick` are inferred from `roundPick` notation (e.g. round 1 slot 9 + round 2 slot 4 = 12 teams, starting pick 9).

---

## Player name resolution

Player names differ between sources: "J. Jefferson" (JSON/board) vs "Justin Jefferson" (master rankings). Resolution happens in `src/lib/parsers/playerIdentity.ts`:

1. Exact full-name match (cheapest)
2. First-initial + last-name + team code match
3. Fuse.js fuzzy fallback (threshold 0.3, only accepts high-confidence single result)

When resolution fails, the raw name is kept and a warning is logged — it never silently drops a player.

---

## Team code normalization

All team codes go through `src/lib/utils/teamCode.ts` before being stored or compared. This handles full nicknames ("49ers" → "SF", "LA Chargers" → "LAC") and alternate spellings ("JAC" → "JAX", "WSH" → "WAS"). **Every team comparison in the codebase must use normalized codes or bugs will silently occur** — the stack/bring-back bug in v1 was caused by skipping this.

---

## Live draft bridge (`bridge/server.ts`)

The bridge is a standalone Node process. It is **not** part of Next.js — excluded from `tsconfig.json` and run separately via `tsx watch`. It imports directly from `../src/lib/...` using relative paths (not `@/` aliases).

**WebSocket message protocol (extension → bridge):**

| Message type | Payload | Effect |
|---|---|---|
| `board_snapshot` | `{ picks[], contestName, totalTeams, myUsername, rosterSize }` | Full board state replace. Idempotent. |
| `on_the_clock` | `{ isOnTheClock: boolean }` | Updates clock state |
| `reset_session` | — | Clears in-memory draft state |
| `refresh_master_players` | — | Reloads MasterPlayer from SQLite |

**On every snapshot the bridge:**
1. Applies picks to in-memory `DraftSessionManager`
2. Builds `myTeamCounts` (team → count of my live picks) and `myTeams` set
3. Builds W17 matchup map from `TeamWeekProjection.week17Opp`
4. For each undrafted MasterPlayer, computes all recommendation fields
5. Sorts by `draftkingsAdp` → `underdogAdp` fallback → pushes nulls to bottom
6. Broadcasts `{ type: "state_update", state, recommended[] }` to all WebSocket clients

**Stack badge logic:**
```typescript
const stackCount = myTeamCounts.get(mp.team.toUpperCase()) ?? 0;
// Only shown in UI when stackCount > 0
```

**W17 bring-back logic:**
```typescript
const w17Opp = week17MatchupMap.get(mp.team.toUpperCase()) ?? null;
const week17BringBack = w17Opp !== null && myTeams.has(w17Opp);
// Both keys stored uppercase to prevent silent mismatches
```

**Known issue as of this writing:** The Chrome extension is not successfully injecting into the DK draft room tab. The manifest uses `run_at: "document_start"` and content.js polls for the root selector (`.SnakeDraft_snake-draft-outer-container`) for up to 30 seconds. The selectors are verified correct against a real DK board HTML snapshot. The sidebar works (shows players) but picks are not streaming live — the player list updates only from the master rankings, not from live board state. Root cause not yet confirmed: likely either a Chrome extension permission issue specific to the user's environment, or DK's SPA navigation model preventing injection after the initial page load. Debug approach: in the DK tab console, run `window.DK_BRIDGE_CONFIG` — if `undefined`, the content script never ran; if defined, the grid scan is failing.

---

## Color scale / conditional formatting

All stat coloring uses `src/lib/analytics/colorScale.ts`. Thresholds are derived from the actual 2026 Vegas data (32 teams), not hardcoded guesses:

```typescript
export const SCALE = {
  weekOU:       { badBelow: 42.5, goodAbove: 48.0 },  // single-week O/U, range 40.5–52.5
  teamTotal:    { badBelow: 20.5, goodAbove: 25.0 },  // per-game team total, range 17–29
  playoffTotal: { badBelow: 63.0, goodAbove: 74.0 },  // sum W15+16+17 totals, range 56–79
};
```

5 tiers: bad (red) → below (orange) → neutral (gray) → above (lime) → good (green).

---

## Live draft UI (`src/components/live/`)

**`LiveBoard.tsx`** — WebSocket client, position filter, search. Connects to `ws://localhost:4001` and falls back to HTTP `GET /state` for instant paint on load. Auto-reconnects every 2 seconds. Filter buttons: ALL / SKILL (hides QBs) / QB / RB / WR / TE / DST / K.

**`PlayerCard.tsx`** — one card per available player. Top row: position badge, name, team, ADP with trend arrow. Middle row: stat blocks (O/U 15–17, Wk 17 O/U, Team Total, My Exp%, UD Δ ADP). Bottom row: live badges (Stack +N in blue, W17 Bring Back in green, Bye conflict in amber, Coupled w/ [player] in purple). Badges only appear when triggered.

**`StatPill.tsx`** — vertical label/value block with colored border. Reusable, standalone.

---

## Analytics modules (`src/lib/analytics/`)

All pure functions — no React, no Prisma, no side effects.

| File | Function | Notes |
|---|---|---|
| `exposure.ts` | `calculateExposure(players, totalDrafts)` | Returns exposure %, avg pick, CLV |
| `correlation.ts` | `buildCoOccurrenceIndex(drafts)` + `checkCorrelationFlag(index, player, roster)` | Jaccard similarity between player pairs. Threshold: jaccardIndex ≥ 0.2 OR co-exposure ≥ 50% |
| `byeConflict.ts` | `checkByeWeekConflict(candidate, rosterSlots)` | Flags when 2+ same-position players share a bye week |
| `colorScale.ts` | `colorScale(value, options)` | 5-tier scale, data-derived thresholds |
| `positionalValue.ts` | `getPositionalValue(entries, player, enabled)` | Feature-flagged, returns null when `enabled=false` |

---

## API routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/import` | DK draft CSV import (legacy, still works) |
| POST | `/api/import/master-rankings` | FantasyPros multi-site ADP CSV → MasterPlayer |
| POST | `/api/import/dk-adp` | DK ADP CSV → MasterPlayer.draftkingsAdp only |
| POST | `/api/import/team-totals` | Vegas team totals CSV → TeamWeekProjection |
| POST | `/api/import/positional-value` | Beersheets CSV → PositionalValue |
| POST | `/api/import/draft-json` | Single draft JSON (legacy upload path) |
| POST | `/api/draft-history` | Sync `data/draft_history.json` → DB with dedup |
| GET | `/api/draft-history` | Returns count of non-live drafts |
| GET | `/api/analytics/exposure` | Exposure table + portfolio stats (excludes `source="live"`) |
| GET/DELETE | `/api/drafts` | List all drafts / clear all data |

---

## Chrome extension

5 files, no build step:

- **`manifest.json`** — MV3, matches `https://www.draftkings.com/*`, `run_at: "document_start"`
- **`selectors.config.js`** — the only file that needs editing when DK changes their markup. Contains all CSS selectors verified against a real DK board. Set `DEBUG: true` for console logging.
- **`content.js`** — runs on DK tab. Polls for root selector every 500ms for 30s, then attaches MutationObserver + 3s interval. Sends `board_snapshot` on every meaningful change (debounced 200ms). Reads player thumbnails' `alt` attribute for full canonical names.
- **`background.js`** — service worker, owns the WebSocket connection to `ws://localhost:4001`. Relays messages from content.js. Auto-reconnects every 2 seconds.
- **`popup.html`** — static info popup, no JS.

**To install:** `chrome://extensions` → Developer mode → Load unpacked → select the `extension/` folder.

---

## Electron sidebar

`electron-sidebar/main.js` (~40 lines). Opens a frameless always-on-top `BrowserWindow` 380px wide, docked to the right edge of the primary display, loading `http://localhost:3000/live-draft`. Has no logic — it's purely a window wrapper. Requires the Next.js app to be running first.

---

## Startup

```bat
start-draft-assistant.bat   ← double-click this, lives in C:\Users\mason\
```

The bat file:
1. Kills any process holding ports 3000 or 4001
2. Opens a `cmd` window running `npm run dev:all` in `dk-portfolio-analyzer/`
3. Waits 12 seconds
4. Opens a `cmd` window running `npm start` in `electron-sidebar/`

Manual equivalent:
```bash
# Terminal 1
cd C:\Users\mason\dk-portfolio-analyzer
npm run dev:all

# Terminal 2 (after app is up)
cd C:\Users\mason\electron-sidebar
npm start
```

Useful maintenance commands (run in `dk-portfolio-analyzer/`):
```bash
npx prisma studio        # visual database browser at localhost:5555
npx prisma migrate dev   # apply schema changes
npx prisma migrate reset --force  # nuclear: wipe and recreate DB
```

---

## Design system

Dark theme. CSS variables defined in `src/app/globals.css`:
```css
--background:    #111318
--surface:       #1a1d24
--surface-raised:#21252e
--border:        #2c3040
--border-subtle: #232733
--text-primary:  #f0f2f7
--text-secondary:#9099b0
--text-muted:    #555e72
--accent:        #4ade80
```

Font: system sans-serif (`-apple-system, Segoe UI, Inter`). No monospace. Tailwind for layout utilities, inline CSS variables for colors (not Tailwind color palette — the palette doesn't map to these values).

Position badge colors: QB=#f87171 RB=#4ade80 WR=#60a5fa TE=#fbbf24 FLEX=#c084fc K=#94a3b8 DST=#2dd4bf

---

## Open issues / known gaps (as of this writing)

1. **Extension injection unconfirmed live** — selectors are verified on post-draft board; live room not yet tested. Debug: `window.DK_BRIDGE_CONFIG` in DK tab console. If undefined, content script didn't run.

2. **Stack/bring-back flags depend on extension** — if picks aren't streaming, `myRoster` is empty and both badges never fire. Workaround: none currently; badges work correctly once extension is confirmed working.

3. **ADP trend arrows** — `adpTrend` field exists in the type and is shown in `PlayerCard` but always `null`. Needs a second ADP snapshot to compute direction. Could be populated by storing `ADPSnapshot` records each time DK ADP CSV is imported.

4. **Positional value (beersheets)** — fully plumbed but feature-flagged. Set `POSITIONAL_VALUE_ENABLED=true` in `.env` and import a CSV with `player_name, position, value` columns.

5. **Exposure table on dashboard** — works but `avgAdp` column shows null for most players until DK ADP CSV has been imported.

6. **`onTheClockMyTurnText`** — set to `null` in `selectors.config.js`, meaning any presence of the countdown element fires "on the clock" regardless of whose turn it is. Should be verified against a live room and tightened.

---

## What NOT to do

- Do not use the `@/` path alias in `bridge/server.ts` — it's excluded from tsconfig and runs via `tsx` which won't resolve it. Use relative `../../src/...` imports.
- Do not store team codes without normalizing through `teamCode.ts` first. Comparison bugs are silent and hard to trace.
- Do not count drafts where `source = "live"` in portfolio analytics. Those are auto-saved mid-session drafts, not intentional entries.
- Do not overwrite `underdogAdp` or `adpDelta` when importing the DK ADP CSV — the `dk-adp` route only touches `draftkingsAdp`.
- Do not wrap the bridge server in Next.js — it must be a standalone process. Putting stateful WebSocket logic inside a Next.js API route will break under hot-reload.
