"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ImportDropzone } from "@/components/ImportDropzone";
import { ExposureTable } from "@/components/ExposureTable";
import { StatsCards } from "@/components/StatsCards";
import { SyncDraftHistoryButton } from "@/components/SyncDraftHistoryButton";
import { DraftPositionChart } from "@/components/DraftPositionChart";
import { RosterArchetypes } from "@/components/RosterArchetypes";
import { QBStacksTable } from "@/components/QBStacksTable";
import { TopOffenses } from "@/components/TopOffenses";
import { DraftStrategies } from "@/components/DraftStrategies";
import type { PlayerExposure, PortfolioStats } from "@/types";

type Tab = "exposure" | "portfolio" | "data";

interface AnalyticsData {
  exposure: PlayerExposure[];
  stats: PortfolioStats;
  draftPositions: Array<{ pick: number; count: number; pct: number }>;
  rosterArchetypes: Array<{ label: string; qb: number; rb: number; wr: number; te: number; count: number; pct: number }>;
  qbStacks: Array<{ qbName: string; team: string; draftCount: number; stackCount: number; stackPct: number; avgStackSize: number; partners: Array<{ name: string; count: number }>; }>;
  topOffenses: Array<{ team: string; totalSelections: number; avgPerDraft: number; uniquePlayers: number; pct: number; }>;
  draftStrategies: Array<{ strategy: string; category: "RB" | "QB" | "TE"; description: string; count: number; pct: number; }>;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}>
      <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>{title}</h3>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("exposure");

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/analytics/exposure");
      if (res.ok) setData(await res.json());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const emptyStats: PortfolioStats = { totalDrafts: 0, totalEntryFees: 0, avgEntryFee: 0, uniquePlayers: 0, dateRange: null };
  const TABS: { key: Tab; label: string }[] = [
    { key: "exposure", label: "Exposure" },
    { key: "portfolio", label: "Portfolio" },
    { key: "data", label: "Import Data" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
      <header className="sticky top-0 z-10 backdrop-blur" style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 80%, transparent)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "#4ade8020" }}>
              <span className="text-sm font-bold" style={{ color: "#4ade80" }}>DK</span>
            </div>
            <div>
              <h1 className="text-sm font-bold">Best Ball Portfolio</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Local Analyzer</p>
            </div>
          </div>
          <Link href="/live-draft" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "#4ade8014", border: "1px solid #4ade8030", color: "#4ade80" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80] animate-pulse" />
            Live Draft Assistant →
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {!isLoading && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Portfolio Overview</p>
            <StatsCards stats={data?.stats ?? emptyStats} />
          </section>
        )}

        <section>
          <div className="flex gap-0 mb-6" style={{ borderBottom: "1px solid var(--border)" }}>
            {TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setActiveTab(key)} className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
                style={{ borderColor: activeTab === key ? "#4ade80" : "transparent", color: activeTab === key ? "var(--text-primary)" : "var(--text-muted)" }}>
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#4ade80", borderTopColor: "transparent" }} />
            </div>
          ) : activeTab === "exposure" ? (
            <ExposureTable data={data?.exposure ?? []} totalDrafts={data?.stats.totalDrafts ?? 0} />

          ) : activeTab === "portfolio" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <SectionCard title="Draft Position Distribution">
                  <DraftPositionChart data={data?.draftPositions ?? []} />
                </SectionCard>
                <SectionCard title="Draft Strategy Breakdown">
                  <DraftStrategies data={data?.draftStrategies ?? []} totalDrafts={data?.stats.totalDrafts ?? 0} />
                </SectionCard>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <SectionCard title="Roster Archetypes">
                  <RosterArchetypes data={data?.rosterArchetypes ?? []} />
                </SectionCard>
                <SectionCard title="Top Offenses">
                  <TopOffenses data={data?.topOffenses ?? []} />
                </SectionCard>
              </div>
              <SectionCard title="Top QB Stacks">
                <QBStacksTable data={data?.qbStacks ?? []} />
              </SectionCard>
            </div>

          ) : (
            <div className="space-y-8">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Master Player Rankings</h3>
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>FantasyPros CSV — DK ADP, Underdog ADP, bye weeks. Import first.</p>
                  <ImportDropzone endpoint="/api/import/master-rankings" label="Drop rankings CSV" hint="Rank, Player, Team, Bye, POS, Underdog, DraftKings, AVG" onImportComplete={fetchAnalytics} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">DK ADP</h3>
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Updates dkAdp only — does not touch Underdog ADP or delta.</p>
                  <ImportDropzone endpoint="/api/import/dk-adp" label="Drop DK ADP CSV" hint="Player, Pos, Team, Bye, ADP, ADP Round, ..." onImportComplete={fetchAnalytics} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Vegas Team Totals (Wk 15–17)</h3>
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Powers O/U, implied team total, W17 bring-back detection.</p>
                  <ImportDropzone endpoint="/api/import/team-totals" label="Drop team totals CSV" hint="Team, W15_OU, W15_TeamTotal, W16_..., W17_..." onImportComplete={fetchAnalytics} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Player Image Mapping</h3>
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>CSV with Player, UID, ImageURL — adds avatars to exposure table and player cards.</p>
                  <ImportDropzone endpoint="/api/import/player-images" label="Drop player image CSV" hint='Player, UID, ImageURL — e.g. "Bijan Robinson","693112","https://..."' onImportComplete={fetchAnalytics} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Positional Value (Beersheets)</h3>
                  <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Feature-flagged off until populated.</p>
                  <ImportDropzone endpoint="/api/import/positional-value" label="Drop positional value CSV" hint="player_name, position, value" onImportComplete={fetchAnalytics} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">Draft History</h3>
                <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                  Append new drafts to <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface-raised)", color: "#9099b0" }}>data/draft_history.json</code>, then click Sync.
                </p>
                <SyncDraftHistoryButton onSynced={fetchAnalytics} />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
