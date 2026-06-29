"use client";

interface TeamOffense {
  team: string; totalSelections: number; avgPerDraft: number;
  uniquePlayers: number; pct: number;
}

// Rough team color map for recognition — falls back to blue
const TEAM_COLORS: Record<string, string> = {
  DAL: "#60a5fa", SF: "#f87171", KC: "#fb923c", BUF: "#60a5fa",
  PHI: "#4ade80", DET: "#60a5fa", MIA: "#2dd4bf", CIN: "#fb923c",
  MIN: "#a855f7", ATL: "#f87171", BAL: "#7c3aed", HOU: "#2dd4bf",
  LAR: "#f59e0b", WAS: "#8b5cf6", GB: "#4ade80", CLE: "#fb923c",
};

export function TopOffenses({ data }: { data: TeamOffense[] }) {
  if (!data.length) return <Empty />;

  const maxSelections = Math.max(...data.map(d => d.totalSelections), 1);

  return (
    <div className="space-y-1.5">
      {data.slice(0, 12).map((t, i) => {
        const color = TEAM_COLORS[t.team] ?? "#60a5fa";
        return (
          <div key={t.team} className="flex items-center gap-3">
            {/* Rank + team */}
            <div className="shrink-0 flex items-center gap-2 w-20">
              <span className="text-xs tabular-nums font-medium w-4 text-right" style={{ color: "#555e72" }}>
                {i + 1}
              </span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded"
                style={{ color, background: `${color}20` }}
              >
                {t.team}
              </span>
            </div>

            {/* Bar */}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full" style={{ background: "#1e2330" }}>
                <div className="h-1.5 rounded-full" style={{
                  width: `${(t.totalSelections / maxSelections) * 100}%`,
                  background: color,
                  opacity: 0.8,
                }} />
              </div>
              <span className="text-xs font-semibold tabular-nums w-6 text-right" style={{ color: "#f0f2f7" }}>
                {t.totalSelections}
              </span>
            </div>

            {/* Secondary stats */}
            <div className="shrink-0 flex gap-3 text-right">
              <div>
                <div className="text-xs tabular-nums font-medium" style={{ color: "#9099b0" }}>
                  {t.avgPerDraft.toFixed(1)}
                </div>
                <div className="text-[9px] uppercase" style={{ color: "#555e72" }}>avg</div>
              </div>
              <div>
                <div className="text-xs tabular-nums font-medium" style={{ color: "#9099b0" }}>
                  {t.uniquePlayers}
                </div>
                <div className="text-[9px] uppercase" style={{ color: "#555e72" }}>uniq</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Empty() {
  return <div className="h-20 flex items-center justify-center text-xs" style={{ color: "#555e72" }}>No team data yet</div>;
}
