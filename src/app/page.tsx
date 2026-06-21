"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ImportDropzone } from "@/components/ImportDropzone";
import { ExposureTable } from "@/components/ExposureTable";
import { StatsCards } from "@/components/StatsCards";
import type { PlayerExposure, PortfolioStats } from "@/types";

interface AnalyticsData {
  exposure: PlayerExposure[];
  stats: PortfolioStats;
}

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"exposure" | "data">("exposure");

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/analytics/exposure");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const emptyStats: PortfolioStats = { totalDrafts: 0, totalEntryFees: 0, avgEntryFee: 0, uniquePlayers: 0, dateRange: null };

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      <header className="border-b border-[#1e1e2e] bg-[#0d0d18]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#53d08a]/20 flex items-center justify-center">
              <span className="text-[#53d08a] font-bold text-sm">DK</span>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Best Ball Portfolio</h1>
              <p className="text-xs text-[#555]">Local Analyzer</p>
            </div>
          </div>

          <Link href="/live-draft" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#53d08a]/10 border border-[#53d08a]/30 text-xs font-medium text-[#53d08a] hover:bg-[#53d08a]/20 transition-colors">
            <span className="h-1.5 w-1.5 rounded-full bg-[#53d08a] animate-pulse" />
            Live Draft Assistant →
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {!isLoading && (
          <section>
            <h2 className="text-xs uppercase tracking-widest text-[#555] font-medium mb-3">Portfolio Overview</h2>
            <StatsCards stats={data?.stats ?? emptyStats} />
          </section>
        )}

        <section>
          <div className="flex gap-1 border-b border-[#1e1e2e] mb-6">
            {(["exposure", "data"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${activeTab === tab ? "border-[#53d08a] text-white" : "border-transparent text-[#555] hover:text-[#888]"}`}>
                {tab === "data" ? "Import Data" : tab}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48"><div className="h-8 w-8 rounded-full border-2 border-[#53d08a] border-t-transparent animate-spin" /></div>
          ) : activeTab === "exposure" ? (
            <ExposureTable data={data?.exposure ?? []} totalDrafts={data?.stats.totalDrafts ?? 0} />
          ) : (
            <div className="space-y-8">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Master Player Rankings</h3>
                  <p className="text-xs text-[#555] mb-3">FantasyPros-style multi-site ADP export. Powers DK/Underdog ADP, the delta, and bye weeks — import this first.</p>
                  <ImportDropzone endpoint="/api/import/master-rankings" label="Drop rankings CSV" hint="Rank, Player, Team, Bye, POS, Underdog, DraftKings, AVG" onImportComplete={fetchAnalytics} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Vegas Team Totals (Wk 15–17)</h3>
                  <p className="text-xs text-[#555] mb-3">Team-keyed — no name matching needed. Powers O/U and implied team total.</p>
                  <ImportDropzone endpoint="/api/import/team-totals" label="Drop team totals CSV" hint="Team, W15_OU, W15_TeamTotal, W16_..., W17_..." onImportComplete={fetchAnalytics} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Past Draft History (JSON)</h3>
                  <p className="text-xs text-[#555] mb-3">Powers personal exposure + correlation. Import rankings first — names get resolved against it.</p>
                  <ImportDropzone endpoint="/api/import/draft-json" label="Drop draft history JSON" hint="One draft object, or an array of them" accept=".json" onImportComplete={fetchAnalytics} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Past Draft History (DK CSV)</h3>
                  <p className="text-xs text-[#555] mb-3">Alternative to the JSON above, if that's the export format you have.</p>
                  <ImportDropzone endpoint="/api/import" label="Drop DK draft export CSV" hint="DraftKings → Best Ball → Export" onImportComplete={fetchAnalytics} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Positional Value (Beersheets)</h3>
                  <p className="text-xs text-[#555] mb-3">Feature-flagged off in the live assistant until populated.</p>
                  <ImportDropzone endpoint="/api/import/positional-value" label="Drop positional value CSV" hint="player_name, position, value" onImportComplete={fetchAnalytics} />
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
