"use client";

import { AlertTriangle, Link2, TrendingUp, TrendingDown } from "lucide-react";
import { StatPill } from "./StatPill";
import { colorScale, isSignificantADPDelta } from "@/lib/analytics/colorScale";
import type { RecommendedPlayer, Position } from "@/types";

const POSITION_COLORS: Record<Position, string> = {
  QB: "#ef4444", RB: "#22c55e", WR: "#3b82f6", TE: "#f59e0b", FLEX: "#a855f7", K: "#6b7280", DST: "#14b8a6",
};

// Implied team totals run lower than combined weekly O/U — separate thresholds.
const ITT_THRESHOLDS = { badBelow: 20, goodAbove: 24 };

export function PlayerCard({ player, showPositionalValue }: { player: RecommendedPlayer; showPositionalValue: boolean }) {
  const posColor = POSITION_COLORS[player.position];
  const significantDelta = isSignificantADPDelta(player.adpDelta);

  return (
    <div className="rounded-lg border border-[#1e1e2e] bg-[#12121c] px-3 py-2.5 hover:border-[#2a2a3a] transition-colors">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{ color: posColor, background: `${posColor}20` }}
          >
            {player.position}
          </span>
          <span className="font-semibold text-sm text-white truncate">{player.name}</span>
          <span className="shrink-0 text-[10px] text-[#555] uppercase">{player.team}</span>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          {player.adp !== null && (
            <span className="text-xs tabular-nums font-bold text-white">{player.adp.toFixed(1)}</span>
          )}
          {player.adpTrend !== null && (
            player.adpTrend < 0
              ? <TrendingUp className="h-3 w-3 text-[#53d08a]" />
              : <TrendingDown className="h-3 w-3 text-red-400" />
          )}
        </div>
      </div>

      {/* Stat pills */}
      <div className="flex flex-wrap items-center gap-1">
        {player.playoffTotalOU !== null && (
          <StatPill label="O/U 15-17" value={player.playoffTotalOU.toFixed(1)} colorHex={colorScale(player.playoffTotalOU).colorHex} />
        )}
        {player.week17OU !== null && (
          <StatPill label="Wk17" value={player.week17OU.toFixed(1)} colorHex={colorScale(player.week17OU).colorHex} />
        )}
        {player.impliedTeamTotal !== null && (
          <StatPill label="ITT" value={player.impliedTeamTotal.toFixed(1)} colorHex={colorScale(player.impliedTeamTotal, ITT_THRESHOLDS).colorHex} />
        )}
        {player.personalExposure !== null && (
          <StatPill label="Mine" value={`${player.personalExposure.toFixed(0)}%`} colorHex={player.personalExposure >= 40 ? "#f59e0b" : "#7eb8f7"} />
        )}
        {showPositionalValue && player.positionalValue !== null && (
          <StatPill label="Val" value={player.positionalValue.toFixed(1)} colorHex="#c77ef7" />
        )}
        {significantDelta && player.adpDelta !== null && (
          <StatPill
            label="UD Δ"
            value={`${player.adpDelta > 0 ? "+" : ""}${player.adpDelta.toFixed(0)}`}
            colorHex={player.adpDelta > 0 ? "#22c55e" : "#ef4444"}
            title={`Goes ${Math.abs(player.adpDelta).toFixed(0)} picks ${player.adpDelta > 0 ? "later" : "earlier"} on DK vs Underdog`}
            emphasis
          />
        )}
      </div>

      {/* Flags row */}
      {(player.byeConflict || player.correlationFlag) && (
        <div className="flex flex-wrap items-center gap-2 mt-1.5 pt-1.5 border-t border-[#1e1e2e]">
          {player.byeConflict && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400" title={`Bye week ${player.byeWeek} conflicts with current roster`}>
              <AlertTriangle className="h-3 w-3" />
              Bye {player.byeWeek} stack
            </span>
          )}
          {player.correlationFlag && (
            <span
              className="flex items-center gap-1 text-[10px] text-purple-400"
              title={`${(player.correlationFlag.jaccardIndex * 100).toFixed(0)}% Jaccard overlap — appears in ${player.correlationFlag.yourCoExposure.toFixed(0)}% of your ${player.correlationFlag.withPlayer} drafts`}
            >
              <Link2 className="h-3 w-3" />
              Coupled w/ {player.correlationFlag.withPlayer}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
