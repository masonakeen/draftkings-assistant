import type { ColorScaleResult } from "../../types";

/**
 * Generic 5-tier color scale for any "higher is better" metric
 * (week O/U totals, implied team total, etc).
 *
 * Default thresholds match the brief: <48 bad, >54 good, linear gradient between.
 */
export function colorScale(
  value: number,
  options: { badBelow?: number; goodAbove?: number } = {}
): ColorScaleResult {
  const { badBelow = 48, goodAbove = 54 } = options;
  const mid = (badBelow + goodAbove) / 2;
  const belowMid = (badBelow + mid) / 2;
  const aboveMid = (mid + goodAbove) / 2;

  let tier: ColorScaleResult["tier"];
  let colorHex: string;

  if (value < badBelow) {
    tier = "bad";
    colorHex = "#ef4444"; // red
  } else if (value < belowMid) {
    tier = "below";
    colorHex = "#f59e0b"; // amber
  } else if (value < aboveMid) {
    tier = "neutral";
    colorHex = "#a1a1aa"; // gray
  } else if (value < goodAbove) {
    tier = "above";
    colorHex = "#84cc16"; // lime
  } else {
    tier = "good";
    colorHex = "#22c55e"; // green
  }

  return { value, tier, colorHex };
}

/**
 * DK ADP vs Underdog ADP — finds players going meaningfully earlier on
 * Underdog than DraftKings (value plays you can still get on DK).
 *
 * Positive delta = player goes LATER on DK than UD = DK value.
 * Negative delta = player goes EARLIER on DK = DK is pricing them up faster.
 */
export function calculateADPDelta(
  dkAdp: number | null,
  underdogAdp: number | null
): number | null {
  if (dkAdp === null || underdogAdp === null) return null;
  return Math.round((dkAdp - underdogAdp) * 10) / 10;
}

export function isSignificantADPDelta(delta: number | null, threshold = 12): boolean {
  return delta !== null && Math.abs(delta) >= threshold;
}
