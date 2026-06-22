"use client";

import { AlertTriangle, Link2, TrendingUp, TrendingDown } from "lucide-react";
import { StatPill } from "./StatPill";
import { colorScale, isSignificantADPDelta, SCALE } from "@/lib/analytics/colorScale";
import type { RecommendedPlayer, Position } from "@/types";

const POSITION_COLORS: Record<Position, string> = {
  QB: "#f87171",
  RB: "#4ade80",
  WR: "#60a5fa",
  TE: "#fbbf24",
  FLEX: "#c084fc",
  K: "#94a3b8",
  DST: "#2dd4bf",
};


export function PlayerCard({
  player,
  showPositionalValue,
}: {
  player: RecommendedPlayer;
  showPositionalValue: boolean;
}) {
  const posColor = POSITION_COLORS[player.position];
  const significantDelta = isSignificantADPDelta(player.adpDelta);

  return (
    <div
      className="rounded-xl px-4 py-3 transition-colors"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {/* ── Top row: position badge · name · team · ADP ── */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Position badge */}
          <span
            className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-md"
            style={{ color: posColor, background: `${posColor}20` }}
          >
            {player.position}
          </span>

          {/* Name */}
          <span className="font-semibold text-base leading-tight truncate" style={{ color: "var(--text-primary)" }}>
            {player.name}
          </span>

          {/* Team */}
          <span className="shrink-0 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>
            {player.team}
          </span>
        </div>

        {/* ADP + trend */}
        <div className="shrink-0 flex items-center gap-1.5">
          {player.adp !== null && (
            <span className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {player.adp.toFixed(1)}
            </span>
          )}
          {player.adpTrend !== null && (
            player.adpTrend < 0
              ? <TrendingUp className="h-4 w-4" style={{ color: "#4ade80" }} />
              : <TrendingDown className="h-4 w-4 text-red-400" />
          )}
        </div>
      </div>

      {/* ── Stat blocks ── */}
      <div className="flex flex-wrap gap-2">
        {player.playoffTotalOU !== null && (
          <StatPill
            label="O/U 15–17"
            value={player.playoffTotalOU.toFixed(1)}
            colorHex={colorScale(player.playoffTotalOU, SCALE.weekOU).colorHex}
          />
        )}
        {player.week17OU !== null && (
          <StatPill
            label="Wk 17 O/U"
            value={player.week17OU.toFixed(1)}
            colorHex={colorScale(player.week17OU, SCALE.weekOU).colorHex}
          />
        )}
        {player.impliedTeamTotal !== null && (
          <StatPill
            label="Team Total"
            value={player.impliedTeamTotal.toFixed(1)}
            colorHex={colorScale(player.impliedTeamTotal, SCALE.teamTotal).colorHex}
          />
        )}
        {player.personalExposure !== null && (
          <StatPill
            label="My Exp."
            value={`${player.personalExposure.toFixed(0)}%`}
            colorHex={player.personalExposure >= 40 ? "#fbbf24" : "#60a5fa"}
          />
        )}
        {showPositionalValue && player.positionalValue !== null && (
          <StatPill
            label="Pos. Val"
            value={player.positionalValue.toFixed(1)}
            colorHex="#c084fc"
          />
        )}
        {significantDelta && player.adpDelta !== null && (
          <StatPill
            label="UD Δ ADP"
            value={`${player.adpDelta > 0 ? "+" : ""}${player.adpDelta.toFixed(0)}`}
            colorHex={player.adpDelta > 0 ? "#4ade80" : "#f87171"}
            title={`Goes ${Math.abs(player.adpDelta).toFixed(0)} picks ${player.adpDelta > 0 ? "later" : "earlier"} on DK vs Underdog`}
            emphasis
          />
        )}
      </div>

      {/* ── Warning flags ── */}
      {(player.byeConflict || player.correlationFlag) && (
        <div
          className="flex flex-wrap gap-3 mt-3 pt-2.5"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {player.byeConflict && (
            <span
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: "#fbbf24" }}
              title={`Bye week ${player.byeWeek} conflicts with your current roster`}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Bye {player.byeWeek} conflict
            </span>
          )}
          {player.correlationFlag && (
            <span
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: "#c084fc" }}
              title={`${(player.correlationFlag.jaccardIndex * 100).toFixed(0)}% overlap — you draft ${player.correlationFlag.withPlayer} together ${player.correlationFlag.yourCoExposure.toFixed(0)}% of the time`}
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              Coupled w/ {player.correlationFlag.withPlayer}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
