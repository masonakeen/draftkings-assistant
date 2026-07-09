// generate_adp_report.js
// Double-click "Generate ADP Report.bat" to run this.
// Reads:  data/overall_draft_history.json
// Writes: data/adp_report.md

const fs   = require("fs");
const path = require("path");

// ─── Paths ───────────────────────────────────────────────────────────────────
const DATA_DIR   = path.join(__dirname, "data");
const INPUT_FILE = path.join(DATA_DIR, "overall_draft_history.json");
const OUT_FILE   = path.join(DATA_DIR, "adp_report.md");

// ─── Stats helpers ───────────────────────────────────────────────────────────
function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const idx  = (p / 100) * (sorted.length - 1);
  const lo   = Math.floor(idx);
  const hi   = Math.ceil(idx);
  const frac = idx - lo;
  return Math.round(sorted[lo] * (1 - frac) + sorted[hi] * frac);
}

// ─── Parse JSON (supports array, wrapped object, or concatenated objects) ────
function splitConcatenatedJson(text) {
  const objects = [];
  let depth = 0, start = -1, inString = false, escapeNext = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext)              { escapeNext = false; continue; }
    if (ch === "\\" && inString) { escapeNext = true;  continue; }
    if (ch === '"')              { inString = !inString; continue; }
    if (inString)                continue;
    if (ch === "{") { if (depth++ === 0) start = i; }
    else if (ch === "}") {
      if (--depth === 0 && start !== -1) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objects;
}

// ─── Load file ───────────────────────────────────────────────────────────────
if (!fs.existsSync(INPUT_FILE)) {
  console.error("ERROR: " + INPUT_FILE + " not found.");
  console.error("Make sure data/overall_draft_history.json exists.");
  process.exit(1);
}

const text = fs.readFileSync(INPUT_FILE, "utf8");
let drafts;

try {
  const raw = JSON.parse(text);
  if (Array.isArray(raw))            drafts = raw;
  else if (Array.isArray(raw.drafts))       drafts = raw.drafts;
  else if (Array.isArray(raw.draftHistory)) drafts = raw.draftHistory;
  else                                      drafts = [raw];
} catch (_) {
  // Concatenated JSON objects with no wrapping array (newline-delimited)
  const chunks = splitConcatenatedJson(text);
  if (chunks.length === 0) {
    console.error("ERROR: Could not parse JSON and found no objects in the file.");
    process.exit(1);
  }
  drafts = [];
  for (const chunk of chunks) {
    try { drafts.push(JSON.parse(chunk)); }
    catch (e) { console.warn("WARN: Skipped malformed block — " + e.message); }
  }
}

if (!drafts || drafts.length === 0) {
  console.error("ERROR: No draft objects found in the file.");
  process.exit(1);
}

console.log("  Loaded " + drafts.length + " draft(s).");

// ─── Collect picks per player ────────────────────────────────────────────────
// Handles both schemas:
//   Legacy:    draft.players[]         (flat, single-team)
//   New multi: draft.teams[].players[] (all teams in the draft room)
//   New flat:  draft.allPlayers[]

const playerMap = new Map(); // "J. Jefferson|WR" → { name, pos, team, picks[] }

function recordPick(playerName, position, team, pick) {
  if (!playerName || typeof pick !== "number") return;
  const key = playerName + "|" + position;
  if (!playerMap.has(key)) {
    playerMap.set(key, { name: playerName, pos: position, team: team || "", picks: [] });
  }
  playerMap.get(key).picks.push(pick);
}

for (const draft of drafts) {
  // Legacy flat players[]
  if (Array.isArray(draft.players) && draft.players.length > 0) {
    for (const p of draft.players) {
      recordPick(p.player, p.position || "", p.team || "", p.pick);
    }
    continue;
  }

  // New multi-team: teams[]
  if (Array.isArray(draft.teams)) {
    for (const t of draft.teams) {
      for (const p of (t.players || [])) {
        recordPick(p.player, p.position || "", p.team || "", p.pick);
      }
    }
    continue;
  }

  // New flat allPlayers[]
  if (Array.isArray(draft.allPlayers)) {
    for (const p of draft.allPlayers) {
      recordPick(p.player, p.position || "", p.team || "", p.pick);
    }
  }
}

if (playerMap.size === 0) {
  console.error("ERROR: No player picks found in any draft.");
  process.exit(1);
}

// ─── Compute stats per player ─────────────────────────────────────────────────
const rows = [];
for (const entry of playerMap.values()) {
  const sorted = entry.picks.slice().sort(function(a, b) { return a - b; });
  rows.push({
    name:   entry.name,
    pos:    entry.pos,
    team:   entry.team,
    drafts: sorted.length,
    median: percentile(sorted, 50),
    min:    sorted[0],
    max:    sorted[sorted.length - 1],
    p10:    percentile(sorted, 10),
    p25:    percentile(sorted, 25),
    p75:    percentile(sorted, 75),
    p90:    percentile(sorted, 90),
  });
}

// Sort by median pick ascending
rows.sort(function(a, b) { return (a.median || 9999) - (b.median || 9999); });

// ─── Build Markdown ───────────────────────────────────────────────────────────
const now = new Date().toLocaleDateString("en-US", {
  year: "numeric", month: "long", day: "numeric",
});

function fmt(v) { return v == null ? "—" : String(v); }

function buildTable(subset, includePos) {
  const cols = includePos
    ? ["#", "Player", "Pos", "Team", "Drafts", "Median", "Min", "Max", "P10", "P25", "P75", "P90"]
    : ["#", "Player", "Team", "Drafts", "Median", "Min", "Max", "P10", "P25", "P75", "P90"];

  const alignRow = includePos
    ? "|---|--------|-----|------|-------:|-------:|----:|----:|----:|----:|----:|----:|"
    : "|---|--------|------|-------:|-------:|----:|----:|----:|----:|----:|----:|";

  const header = "| " + cols.join(" | ") + " |";
  const dataRows = subset.map(function(r, i) {
    const cells = includePos
      ? [i + 1, r.name, r.pos, r.team, r.drafts, fmt(r.median), fmt(r.min), fmt(r.max), fmt(r.p10), fmt(r.p25), fmt(r.p75), fmt(r.p90)]
      : [i + 1, r.name, r.team, r.drafts, fmt(r.median), fmt(r.min), fmt(r.max), fmt(r.p10), fmt(r.p25), fmt(r.p75), fmt(r.p90)];
    return "| " + cells.join(" | ") + " |";
  });

  return [header, alignRow].concat(dataRows).join("\n");
}

const lines = [
  "# ADP Report",
  "",
  "Generated: " + now + "  ",
  "Sample: **" + drafts.length + " draft" + (drafts.length !== 1 ? "s" : "") + "** · **" + rows.length + " unique players**",
  "",
  "> Columns are pick numbers (overall). P10 = earliest realistic pick; P90 = latest.",
  "",
  "## All Players",
  "",
  buildTable(rows, true),
  "",
  "---",
  "",
];

const POSITIONS = ["QB", "RB", "WR", "TE"];
for (const pos of POSITIONS) {
  const subset = rows.filter(function(r) { return r.pos.toUpperCase() === pos; });
  if (subset.length === 0) continue;
  lines.push("## " + pos);
  lines.push("");
  lines.push(buildTable(subset, false));
  lines.push("");
}

// ─── Write output ─────────────────────────────────────────────────────────────
fs.writeFileSync(OUT_FILE, lines.join("\n"), "utf8");
console.log("\u2713 Report written to: " + OUT_FILE);
console.log("  " + drafts.length + " drafts \u00B7 " + rows.length + " players\n");