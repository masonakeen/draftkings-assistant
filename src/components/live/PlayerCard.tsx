"use client";

import { AlertTriangle, Link2, Layers, ArrowLeftRight } from "lucide-react";
import { StatPill } from "./StatPill";
import { colorScale, isSignificantADPDelta, SCALE } from "@/lib/analytics/colorScale";
import type { RecommendedPlayer, Position } from "@/types";

const POSITION_COLORS: Record<Position, string> = {
  QB: "#f87171", RB: "#4ade80", WR: "#60a5fa",
  TE: "#fbbf24", FLEX: "#c084fc", K: "#94a3b8", DST: "#2dd4bf",
};

const BADGE_STYLES = {
  stack:       { bg: "#4ade8014", border: "#4ade8066", color: "#4ade80", glow: true },
  bringback:   { bg: "#4ade8014", border: "#4ade8066", color: "#4ade80", glow: true },
  bye:         { bg: "#fbbf2414", border: "#fbbf2444", color: "#fbbf24", glow: false },
  correlation: { bg: "#c084fc14", border: "#c084fc44", color: "#c084fc", glow: false },
};

function Badge({ style, icon, label, title }: {
  style: typeof BADGE_STYLES[keyof typeof BADGE_STYLES];
  icon: React.ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        boxShadow: style.glow ? `0 0 8px ${style.border}` : "none",
      }}
      title={title}
    >
      {icon}
      {label}
    </span>
  );
}

export function PlayerCard({ player, showPositionalValue }: {
  player: RecommendedPlayer;
  showPositionalValue: boolean;
}) {
  const posColor = POSITION_COLORS[player.position];
  const hasStack = player.stackCount > 0;
  const hasBringBack = player.week17BringBack;
  const hasByeConflict = player.byeConflict;
  const hasCorrelation = !!player.correlationFlag;
  const significantDelta = isSignificantADPDelta(player.adpDelta);
  const hasPositiveSignal = hasStack || hasBringBack;

  // dkAdp is the source of truth for display rank — falls back to udAdp
  const displayAdp = player.dkAdp ?? player.underdogAdp;

  return (
    <div
      className="rounded-xl transition-all"
      style={{
        background: "var(--surface)",
        border: hasPositiveSignal ? "1px solid #4ade8055" : "1px solid var(--border-subtle)",
        boxShadow: hasPositiveSignal ? "0 0 12px #4ade8022" : "none",
      }}
    >
      <div className="flex gap-0 items-stretch">

        {/* ── LEFT: identity + badges ── */}
        <div className="flex-1 min-w-0 px-3.5 py-3">

          {/* Position badge + DK ADP rank */}
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: posColor, background: `${posColor}20` }}
            >
              {player.position}
            </span>
            {/* DK ADP — white, clearly labeled */}
            <span className="text-xs font-bold tabular-nums" style={{ color: "#ffffff" }}>
              {displayAdp != null ? `#${displayAdp.toFixed(1)}` : "—"}
            </span>
          </div>

          {/* Player name — dominant, white */}
          <span className="text-lg font-bold leading-tight block truncate" style={{ color: "#ffffff" }}>
            {player.name}
          </span>

          {/* Team + bye — both white, readable */}
          <div className="flex items-center gap-2 mt-0.5 mb-2.5">
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "#ffffff" }}>
              {player.team}
            </span>
            {player.byeWeek != null && (
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ color: "#ffffff", background: "#ffffff18", border: "1px solid #ffffff30" }}
              >
                Bye {player.byeWeek}
              </span>
            )}
          </div>

          {/* Exposure — white outline box when non-zero */}
          {player.personalExposure != null && player.personalExposure > 0 && (
            <div className="mb-2">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md"
                style={{
                  color: player.personalExposure >= 40 ? "#fbbf24" : "#ffffff",
                  background: player.personalExposure >= 40 ? "#fbbf2414" : "#ffffff0a",
                  border: player.personalExposure >= 40 ? "1px solid #fbbf2444" : "1px solid #ffffff40",
                }}
              >
                {player.personalExposure.toFixed(0)}% exposure
              </span>
            </div>
          )}

          {/* Live draft badges */}
          <div className="flex flex-wrap gap-1.5 min-h-[26px]">
            {hasStack && (
              <Badge
                style={BADGE_STYLES.stack}
                icon={<Layers className="h-3 w-3 shrink-0" />}
                label={`Stack +${player.stackCount}`}
                title={`${player.stackCount} of your picks are already from ${player.team}`}
              />
            )}
            {hasBringBack && (
              <Badge
                style={BADGE_STYLES.bringback}
                icon={<ArrowLeftRight className="h-3 w-3 shrink-0" />}
                label="W17 Bring Back"
                title={`${player.team} plays ${player.week17Opponent} in W17 — you have players on ${player.week17Opponent}`}
              />
            )}
            {hasByeConflict && (
              <Badge
                style={BADGE_STYLES.bye}
                icon={<AlertTriangle className="h-3 w-3 shrink-0" />}
                label={`Bye ${player.byeWeek} conflict`}
              />
            )}
            {hasCorrelation && player.correlationFlag && (
              <Badge
                style={BADGE_STYLES.correlation}
                icon={<Link2 className="h-3 w-3 shrink-0" />}
                label={`Coupled w/ ${player.correlationFlag.withPlayer}`}
                title={`${(player.correlationFlag.jaccardIndex * 100).toFixed(0)}% Jaccard — co-drafted ${player.correlationFlag.yourCoExposure.toFixed(0)}% of the time`}
              />
            )}
          </div>
        </div>

        {/* ── RIGHT: vertical stats ── */}
        <div
          className="shrink-0 w-[76px] flex flex-col gap-1 p-2 justify-center rounded-r-xl"
          style={{ borderLeft: "1px solid var(--border-subtle)", background: "var(--surface-raised)" }}
        >
          {player.playoffTotalOU != null && (
            <StatPill
              label="O/U 15–17"
              value={player.playoffTotalOU.toFixed(1)}
              colorHex={colorScale(player.playoffTotalOU, SCALE.weekOU).colorHex}
            />
          )}
          {player.week17OU != null && (
            <StatPill
              label="Wk17 O/U"
              value={player.week17OU.toFixed(1)}
              colorHex={colorScale(player.week17OU, SCALE.weekOU).colorHex}
            />
          )}
          {player.impliedTeamTotal != null && (
            <StatPill
              label="Team Tot."
              value={player.impliedTeamTotal.toFixed(1)}
              colorHex={colorScale(player.impliedTeamTotal, SCALE.teamTotal).colorHex}
            />
          )}
          {significantDelta && player.adpDelta != null && (
            <StatPill
              label="UD Δ"
              value={`${player.adpDelta > 0 ? "+" : ""}${player.adpDelta.toFixed(0)}`}
              colorHex={player.adpDelta > 0 ? "#4ade80" : "#f87171"}
              title={`Goes ${Math.abs(player.adpDelta).toFixed(0)} picks ${player.adpDelta > 0 ? "later" : "earlier"} on DK vs Underdog`}
              emphasis
            />
          )}
          {showPositionalValue && player.positionalValue != null && (
            <StatPill label="Pos. Val" value={player.positionalValue.toFixed(1)} colorHex="#c084fc" />
          )}
          {player.playoffTotalOU == null && player.week17OU == null && player.impliedTeamTotal == null && (
            <span className="text-[9px] text-center" style={{ color: "var(--text-muted)" }}>
              Import team totals
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
