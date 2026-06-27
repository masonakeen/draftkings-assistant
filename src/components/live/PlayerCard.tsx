"use client";

import { AlertTriangle, Link2, TrendingUp, TrendingDown, Layers, ArrowLeftRight } from "lucide-react";
import { StatPill } from "./StatPill";
import { colorScale, isSignificantADPDelta, SCALE } from "@/lib/analytics/colorScale";
import type { RecommendedPlayer, Position } from "@/types";

const POSITION_COLORS: Record<Position, string> = {
  QB: "#f87171", RB: "#4ade80", WR: "#60a5fa",
  TE: "#fbbf24", FLEX: "#c084fc", K: "#94a3b8", DST: "#2dd4bf",
};

export function PlayerCard({ player, showPositionalValue }: { player: RecommendedPlayer; showPositionalValue: boolean }) {
  const posColor = POSITION_COLORS[player.position];
  const significantDelta = isSignificantADPDelta(player.adpDelta);
  const hasStack = player.stackCount > 0;
  const hasBringBack = player.week17BringBack;

  return (
    <div
      className="rounded-xl px-4 py-3 transition-colors"
      style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
    >
      {/* ── Top row: position · name · team · ADP ── */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-md"
            style={{ color: posColor, background: `${posColor}20` }}
          >
            {player.position}
          </span>
          <span className="font-semibold text-base leading-tight truncate" style={{ color: "var(--text-primary)" }}>
            {player.name}
          </span>
          <span className="shrink-0 text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>
            {player.team}
          </span>
        </div>

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
      <div className="flex flex-wrap gap-2 mb-2">
        {player.playoffTotalOU !== null && (
          <StatPill label="O/U 15–17" value={player.playoffTotalOU.toFixed(1)} colorHex={colorScale(player.playoffTotalOU, SCALE.weekOU).colorHex} />
        )}
        {player.week17OU !== null && (
          <StatPill label="Wk 17 O/U" value={player.week17OU.toFixed(1)} colorHex={colorScale(player.week17OU, SCALE.weekOU).colorHex} />
        )}
        {player.impliedTeamTotal !== null && (
          <StatPill label="Team Total" value={player.impliedTeamTotal.toFixed(1)} colorHex={colorScale(player.impliedTeamTotal, SCALE.teamTotal).colorHex} />
        )}
        {player.personalExposure !== null && (
          <StatPill label="My Exp." value={`${player.personalExposure.toFixed(0)}%`} colorHex={player.personalExposure >= 40 ? "#fbbf24" : "#60a5fa"} />
        )}
        {showPositionalValue && player.positionalValue !== null && (
          <StatPill label="Pos. Val" value={player.positionalValue.toFixed(1)} colorHex="#c084fc" />
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

      {/* ── Live draft badges ── */}
      {(hasStack || hasBringBack || player.byeConflict || player.correlationFlag) && (
        <div className="flex flex-wrap gap-2 pt-2.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>

          {hasStack && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
              style={{ background: "#60a5fa18", border: "1px solid #60a5fa40", color: "#60a5fa" }}
              title={`You already have ${player.stackCount} player${player.stackCount > 1 ? "s" : ""} from ${player.team} on this roster`}
            >
              <Layers className="h-3.5 w-3.5 shrink-0" />
              Stack +{player.stackCount}
            </span>
          )}

          {hasBringBack && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
              style={{ background: "#4ade8018", border: "1px solid #4ade8040", color: "#4ade80" }}
              title={`${player.team} plays ${player.week17Opponent} in W17 — you have players on ${player.week17Opponent}`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
              W17 Bring Back
            </span>
          )}

          {player.byeConflict && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
              style={{ background: "#fbbf2418", border: "1px solid #fbbf2440", color: "#fbbf24" }}
              title={`Bye week ${player.byeWeek} conflicts with your current roster`}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Bye {player.byeWeek} conflict
            </span>
          )}

          {player.correlationFlag && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
              style={{ background: "#c084fc18", border: "1px solid #c084fc40", color: "#c084fc" }}
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
