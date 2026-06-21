"use client";

import type { PortfolioStats } from "@/types";

function StatCard({ label, value, sub, color = "#53d08a" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-[#12121c] border border-[#1e1e2e] p-5 flex flex-col gap-1">
      <p className="text-xs uppercase tracking-widest font-medium text-[#555]">{label}</p>
      <p className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-[#555]">{sub}</p>}
    </div>
  );
}

export function StatsCards({ stats }: { stats: PortfolioStats }) {
  const dateStr = stats.dateRange
    ? `${new Date(stats.dateRange.earliest).toLocaleDateString()} – ${new Date(stats.dateRange.latest).toLocaleDateString()}`
    : "—";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Total Drafts" value={stats.totalDrafts.toLocaleString()} sub={dateStr} />
      <StatCard label="Total Invested" value={`$${stats.totalEntryFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub={`avg $${stats.avgEntryFee} / draft`} color="#7eb8f7" />
      <StatCard label="Unique Players" value={stats.uniquePlayers.toLocaleString()} sub="across all drafts" color="#f7c97e" />
      <StatCard label="Avg Draft Fee" value={`$${stats.avgEntryFee}`} color="#c77ef7" />
    </div>
  );
}
