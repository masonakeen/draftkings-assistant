import type { Position } from "../../types";

export interface PositionalValueEntry {
  playerName: string;
  position: Position;
  value: number;
}

/**
 * Feature-flagged: returns null for everyone until you've imported a
 * positional-value ("beersheets") CSV. Once populated, returns the static
 * value for a player. A future iteration can make this dynamic — recomputing
 * "remaining value at position" as players are drafted off the board — but
 * for now this is a straight lookup, which is enough to wire up the UI.
 */
export function getPositionalValue(
  entries: PositionalValueEntry[],
  playerName: string,
  enabled: boolean
): number | null {
  if (!enabled) return null;

  const match = entries.find(
    (e) => e.playerName.toLowerCase() === playerName.toLowerCase()
  );
  return match ? match.value : null;
}

/**
 * Stub for the future dynamic version: given remaining (undrafted) players
 * at a position, re-rank value relative to what's left. Not wired up yet —
 * kept here so the eventual upgrade doesn't require restructuring callers.
 */
export function recalculateRemainingPositionalValue(
  entries: PositionalValueEntry[],
  draftedPlayerNames: Set<string>,
  _position: Position
): PositionalValueEntry[] {
  return entries.filter(
    (e) => !draftedPlayerNames.has(e.playerName.toLowerCase())
  );
}
