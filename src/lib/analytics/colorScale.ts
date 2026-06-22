import type { ColorScaleResult } from "../../types";

/**
 * Generic 5-tier color scale. p20 = bad threshold, p80 = good threshold.
 * Values are clamped to the range and interpolated linearly between tiers.
 * Thresholds below are derived from the actual 2026 Vegas data (32 teams).
 */
export function colorScale(
  value: number,
  options: { badBelow?: number; goodAbove?: number } = {}
): ColorScaleResult {
  const { badBelow = 42.5, goodAbove = 48.0 } = options;
  const mid = (badBelow + goodAbove) / 2;
  const belowMid = (badBelow + mid) / 2;
  const aboveMid = (mid + goodAbove) / 2;

  let tier: ColorScaleResult["tier"];
  let colorHex: string;

  if (value < badBelow) {
    tier = "bad";
    colorHex = "#f87171"; // red
  } else if (value < belowMid) {
    tier = "below";
    colorHex = "#fb923c"; // orange
  } else if (value < aboveMid) {
    tier = "neutral";
    colorHex = "#9099b0"; // gray
  } else if (value < goodAbove) {
    tier = "above";
    colorHex = "#a3e635"; // lime
  } else {
    tier = "good";
    colorHex = "#4ade80"; // green
  }

  return { value, tier, colorHex };
}

/**
 * Preset threshold sets derived from the real 2026 Vegas distribution.
 * Pass these as the second argument to colorScale().
 */
export const SCALE = {
  // Single-week game O/U (any of wk15/16/17). Range 40.5–52.5, mean 45.8.
  weekOU:         { badBelow: 42.5, goodAbove: 48.0 },

  // Per-game team total (points for one team in one game). Range 17–29, mean 22.9.
  teamTotal:      { badBelow: 20.5, goodAbove: 25.0 },

  // Projected playoff total (sum of wk15+16+17 team totals). Range 56–79, mean 68.5.
  playoffTotal:   { badBelow: 63.0, goodAbove: 74.0 },
} as const;

/**
 * ADP delta: DK ADP minus Underdog ADP.
 * Positive = player goes later on DK than UD = DK value.
 * Negative = player goes earlier on DK = UD sees them as better value.
 * Only flag deltas large enough to be meaningful (~half a round+).
 */
export function calculateADPDelta(
  dkAdp: number | null,
  underdogAdp: number | null
): number | null {
  if (dkAdp === null || underdogAdp === null) return null;
  return Math.round((dkAdp - underdogAdp) * 10) / 10;
}

export function isSignificantADPDelta(delta: number | null, threshold = 8): boolean {
  return delta !== null && Math.abs(delta) >= threshold;
}
