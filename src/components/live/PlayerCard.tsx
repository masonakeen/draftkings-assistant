"use client";

import { AlertTriangle, Link2, Layers, ArrowLeftRight } from "lucide-react";
import { StatPill } from "./StatPill";
import { colorScale, isSignificantADPDelta, SCALE } from "@/lib/analytics/colorScale";
import type { RecommendedPlayer, Position } from "@/types";

const POSITION_COLORS: Record<Position, string> = {
  QB: "#f87171", RB: "#4ade80", WR: "#60a5fa",
  TE: "#fbbf24", FLEX: "#c084fc", K: "#94a3b8", DST: "#2dd4bf",
};

// Badge config — stack and bring-back get a prominent green glow border
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
  const hasBadges = hasStack || hasBringBack || hasByeConflict || hasCorrelation;

  // Card border glows green when there's a positive signal (stack or bring-back)
  const hasPositiveSignal = hasStack || hasBringBack;

  return (
    <div
      className="rounded-xl transition-all"
      style={{
        background: "var(--surface)",
        border: hasPositiveSignal
          ? "1px solid #4ade8055"
          : "1px solid var(--border-subtle)",
        boxShadow: hasPositiveSignal ? "0 0 12px #4ade8022" : "none",
      }}
    >
      {/* ── Main body: left content + right stats column ── */}
      <div className="flex gap-0 items-stretch">

        {/* ── LEFT: name block + badges ── */}
        <div className="flex-1 min-w-0 px-3.5 py-3">

          {/* Position badge + ADP on same line */}
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: posColor, background: `${posColor}20` }}
            >
              {player.position}
            </span>
            <span className="text-xs tabular-nums font-medium" style={{ color: "var(--text-muted)" }}>
              {player.adp != null ? `#${player.adp.toFixed(1)}` : "—"}
            </span>
          </div>

          {/* Player name — dominant */}
          <div className="mb-0.5">
            <span className="text-lg font-bold leading-tight block truncate" style={{ color: "#ffffff" }}>
              {player.name}
            </span>
          </div>

          {/* Team — white, readable */}
          <div className="mb-2.5">
            <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: "#ffffff" }}>
              {player.team}
            </span>
            {player.byeWeek != null && (
              <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                Bye {player.byeWeek}
              </span>
            )}
          </div>

          {/* Badges row — always reserve space so cards don't jump */}
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
                title="Bye week overlaps with existing roster"
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

          {/* Exposure — subtle, below badges */}
          {player.personalExposure != null && (
            <div className="mt-2">
              <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                My exposure: {" "}
                <span style={{ color: player.personalExposure >= 40 ? "#fbbf24" : "#9099b0" }}>
                  {player.personalExposure.toFixed(0)}%
                </span>
              </span>
            </div>
          )}
        </div>

        {/* ── RIGHT: vertical stats column ── */}
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
          {/* Spacer when no stats yet imported */}
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
