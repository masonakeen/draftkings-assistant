// build_adp_markdown.js

const fs = require("fs");

const INPUT = "./draft_history.json";
const OUTPUT = "./draft_adp_stats.md";

// ---------------- Helpers ----------------

function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
    const m = mean(arr);
    const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
}

function percentile(sorted, p) {
    if (sorted.length === 1) return sorted[0];

    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper)
        return sorted[lower];

    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

// ---------------- Load ----------------

const drafts = JSON.parse(fs.readFileSync(INPUT, "utf8"));

const players = new Map();

for (const draft of drafts) {

    for (const p of draft.players) {

        const key = p.playerID ?? p.player;

        if (!players.has(key)) {
            players.set(key, {
                player: p.player,
                position: p.position,
                team: p.team,
                picks: []
            });
        }

        players.get(key).picks.push(Number(p.pick));
    }
}

// ---------------- Calculate ----------------

const stats = [];

for (const player of players.values()) {

    const picks = [...player.picks].sort((a, b) => a - b);

    const p10 = percentile(picks, 0.10);
    const p25 = percentile(picks, 0.25);
    const p50 = percentile(picks, 0.50);
    const p75 = percentile(picks, 0.75);
    const p90 = percentile(picks, 0.90);

    stats.push({
        Player: player.player,
        Position: player.position,
        Team: player.team,
        Drafts: picks.length,
        Mean: mean(picks),
        Min: picks[0],
        P10: p10,
        P25: p25,
        Median: p50,
        P75: p75,
        P90: p90,
        Max: picks[picks.length - 1],
        StdDev: stdDev(picks),
        Range: `${Math.round(p25)}–${Math.round(p75)}`
    });
}

// Sort by average ADP
stats.sort((a, b) => a.Mean - b.Mean);

// ---------------- Markdown ----------------

let md = "# Draft ADP Statistics\n\n";

md += "| Rank | Player | Pos | Team | Drafts | Mean | Min | P10 | P25 | Median | P75 | P90 | Max | Std Dev | ADP Range |\n";
md += "|---:|---|:--:|:--:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|\n";

stats.forEach((p, i) => {

    md += `| ${i + 1}` +
        ` | ${p.Player}` +
        ` | ${p.Position}` +
        ` | ${p.Team}` +
        ` | ${p.Drafts}` +
        ` | ${p.Mean.toFixed(2)}` +
        ` | ${p.Min}` +
        ` | ${p.P10.toFixed(1)}` +
        ` | ${p.P25.toFixed(1)}` +
        ` | ${p.Median.toFixed(1)}` +
        ` | ${p.P75.toFixed(1)}` +
        ` | ${p.P90.toFixed(1)}` +
        ` | ${p.Max}` +
        ` | ${p.StdDev.toFixed(2)}` +
        ` | ${p.Range} |\n`;
});

fs.writeFileSync(OUTPUT, md);

console.log(`Created ${OUTPUT}`);