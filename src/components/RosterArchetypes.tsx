"use client";

interface Archetype { label: string; qb: number; rb: number; wr: number; te: number; count: number; pct: number; }

const POS_COLORS: Record<string, string> = {
  QB: "#f87171", RB: "#4ade80", WR: "#60a5fa", TE: "#fbbf24",
};

export function RosterArchetypes({ data }: { data: Archetype[] }) {
  if (!data.length) return <Empty />;
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="space-y-2">
      {data.slice(0, 8).map(a => (
        <div key={a.label} className="flex items-center gap-3">
          {/* Archetype label as position chips */}
          <div className="flex gap-1 shrink-0 w-44">
            {[
              { pos: "QB", n: a.qb },
              { pos: "RB", n: a.rb },
              { pos: "WR", n: a.wr },
              { pos: "TE", n: a.te },
            ].map(({ pos, n }) => (
              <span key={pos} className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                color: POS_COLORS[pos], background: `${POS_COLORS[pos]}20`,
              }}>
                {n}{pos}
              </span>
            ))}
          </div>
          {/* Bar */}
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full" style={{ background: "#1e2330" }}>
              <div className="h-2 rounded-full transition-all" style={{
                width: `${(a.count / maxCount) * 100}%`,
                background: "linear-gradient(90deg, #60a5fa, #4ade80)",
              }} />
            </div>
            <span className="text-xs tabular-nums font-semibold w-8 text-right" style={{ color: "#f0f2f7" }}>
              {a.count}
            </span>
            <span className="text-xs tabular-nums w-10 text-right" style={{ color: "#6b7280" }}>
              {a.pct}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return <div className="h-20 flex items-center justify-center text-xs" style={{ color: "#555e72" }}>No roster data yet</div>;
}
