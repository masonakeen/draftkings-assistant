"use client";

interface Partner { name: string; count: number; }
interface QBStack {
  qbName: string; team: string; draftCount: number;
  stackCount: number; stackPct: number; avgStackSize: number;
  partners: Partner[];
}

export function QBStacksTable({ data }: { data: QBStack[] }) {
  if (!data.length) return <Empty />;

  return (
    <div className="space-y-2.5">
      {data.slice(0, 8).map(s => (
        <div
          key={s.qbName}
          className="rounded-lg px-3.5 py-2.5"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: "#f87171", background: "#f8717120" }}>QB</span>
              <span className="text-sm font-bold truncate" style={{ color: "#ffffff" }}>{s.qbName}</span>
              <span className="text-xs font-semibold uppercase" style={{ color: "#6b7280" }}>{s.team}</span>
            </div>
            <div className="shrink-0 flex items-center gap-3 ml-2">
              <div className="text-right">
                <div className="text-base font-bold tabular-nums" style={{ color: "#4ade80" }}>{s.stackCount}</div>
                <div className="text-[9px] uppercase tracking-wide" style={{ color: "#6b7280" }}>stacks</div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold tabular-nums" style={{ color: "#f0f2f7" }}>{s.draftCount}</div>
                <div className="text-[9px] uppercase tracking-wide" style={{ color: "#6b7280" }}>drafts</div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold tabular-nums" style={{ color: "#60a5fa" }}>{s.stackPct}%</div>
                <div className="text-[9px] uppercase tracking-wide" style={{ color: "#6b7280" }}>stack%</div>
              </div>
            </div>
          </div>

          {s.partners.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {s.partners.map(p => (
                <span
                  key={p.name}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "#4ade8014", border: "1px solid #4ade8030", color: "#9099b0" }}
                >
                  {p.name} <span style={{ color: "#4ade80" }}>×{p.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return <div className="h-20 flex items-center justify-center text-xs" style={{ color: "#555e72" }}>No QB stack data yet</div>;
}
