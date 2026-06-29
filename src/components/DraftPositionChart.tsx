"use client";

interface Bucket { pick: number; count: number; pct: number; }

export function DraftPositionChart({ data }: { data: Bucket[] }) {
  if (!data.length) return <Empty label="No draft position data yet" />;

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div>
      <div className="flex items-end gap-1.5 h-28">
        {data.map(b => {
          const heightPct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
          const isSnake = b.pick <= 6; // first half = early picks
          return (
            <div key={b.pick} className="flex-1 flex flex-col items-center gap-1 group" title={`Pick ${b.pick}: ${b.count} draft${b.count !== 1 ? "s" : ""} (${b.pct}%)`}>
              <span className="text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity tabular-nums" style={{ color: "#9099b0" }}>
                {b.count > 0 ? b.count : ""}
              </span>
              <div className="w-full rounded-t-sm transition-all" style={{
                height: `${Math.max(heightPct, b.count > 0 ? 6 : 0)}%`,
                background: b.count === 0 ? "#1e2330" : isSnake ? "#60a5fa" : "#4ade80",
                minHeight: b.count > 0 ? "4px" : "2px",
              }} />
              <span className="text-[9px] tabular-nums font-medium" style={{ color: "#6b7280" }}>{b.pick}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3">
        <Legend color="#60a5fa" label="Picks 1–6" />
        <Legend color="#4ade80" label="Picks 7–12" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-xs" style={{ color: "#9099b0" }}>{label}</span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="h-28 flex items-center justify-center text-xs" style={{ color: "#555e72" }}>{label}</div>;
}
