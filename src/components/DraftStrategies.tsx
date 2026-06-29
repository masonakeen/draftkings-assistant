"use client";

interface Strategy {
  strategy: string;
  category: "RB" | "QB" | "TE";
  description: string;
  count: number;
  pct: number;
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  RB: { color: "#4ade80", bg: "#4ade8020" },
  QB: { color: "#f87171", bg: "#f8717120" },
  TE: { color: "#fbbf24", bg: "#fbbf2420" },
};

const CATEGORY_ORDER = ["RB", "QB", "TE"];

export function DraftStrategies({ data, totalDrafts }: { data: Strategy[]; totalDrafts: number }) {
  if (!data.length || totalDrafts === 0) {
    return (
      <div className="h-20 flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>
        No draft history yet
      </div>
    );
  }

  // Group by category and keep order
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = data.filter(s => s.category === cat);
    return acc;
  }, {} as Record<string, Strategy[]>);

  return (
    <div className="space-y-5">
      {CATEGORY_ORDER.map(cat => {
        const strategies = grouped[cat] ?? [];
        const { color, bg } = CATEGORY_COLORS[cat];
        // Within each category, the counts should sum to ≤ totalDrafts
        const maxCount = Math.max(...strategies.map(s => s.count), 1);

        return (
          <div key={cat}>
            {/* Category header */}
            <div className="flex items-center gap-2 mb-2.5">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded"
                style={{ color, background: bg }}
              >
                {cat}
              </span>
              <div className="flex-1 h-px" style={{ background: "var(--border-subtle)" }} />
            </div>

            {/* Strategy rows */}
            <div className="space-y-1.5">
              {strategies.map(s => (
                <div key={s.strategy} className="flex items-center gap-3" title={s.description}>
                  {/* Strategy name */}
                  <span
                    className="text-xs font-semibold w-36 shrink-0 truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {s.strategy}
                  </span>

                  {/* Bar */}
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full" style={{ background: "#1e2330" }}>
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: s.count > 0 ? `${(s.count / maxCount) * 100}%` : "0%",
                          background: color,
                          opacity: s.count > 0 ? 0.85 : 0.2,
                        }}
                      />
                    </div>
                  </div>

                  {/* Count + pct */}
                  <div className="shrink-0 flex items-center gap-2 w-20 justify-end">
                    <span className="text-xs font-bold tabular-nums" style={{ color: s.count > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {s.count}
                    </span>
                    <span className="text-xs tabular-nums w-10 text-right" style={{ color: "var(--text-muted)" }}>
                      {s.pct > 0 ? `${s.pct}%` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Footer note */}
      <p className="text-[10px] pt-1" style={{ color: "var(--text-muted)" }}>
        Strategies within each group are not mutually exclusive — a draft may qualify for multiple labels
      </p>
    </div>
  );
}
