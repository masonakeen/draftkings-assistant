import type { Position } from "../../types";

export interface RosterSlot {
  name: string;
  team: string;
  position: Position;
  byeWeek: number | null;
}

/**
 * Flags whether drafting `candidate` would stack a bye week against players
 * you already rostered at the same or an overlapping position (RB/FLEX,
 * WR/FLEX) — the classic "my backup RB has the same bye as my starter" trap.
 *
 * Pure function: takes already-resolved bye weeks (from the ByeWeek table),
 * does not look anything up itself.
 */
export function checkByeWeekConflict(
  candidate: { team: string; position: Position; byeWeek: number | null },
  currentRoster: RosterSlot[],
  options: { samePositionThreshold?: number } = {}
): { conflict: boolean; conflictingPlayers: string[] } {
  const { samePositionThreshold = 2 } = options;

  if (candidate.byeWeek === null) {
    return { conflict: false, conflictingPlayers: [] };
  }

  // Positions that "compete" for the same roster slot during bye weeks
  const overlapGroup: Record<Position, Position[]> = {
    QB: ["QB"],
    RB: ["RB", "FLEX"],
    WR: ["WR", "FLEX"],
    TE: ["TE", "FLEX"],
    FLEX: ["RB", "WR", "TE", "FLEX"],
    K: ["K"],
    DST: ["DST"],
  };

  const relevantPositions = overlapGroup[candidate.position] ?? [candidate.position];

  const sameByePlayers = currentRoster.filter(
    (slot) =>
      slot.byeWeek === candidate.byeWeek &&
      relevantPositions.includes(slot.position)
  );

  // +1 to account for the candidate itself joining the group.
  // Default threshold of 2 means: 1 existing same-bye/same-group player + this
  // candidate = 2 total triggers the flag.
  const conflict = sameByePlayers.length + 1 >= samePositionThreshold;

  return {
    conflict,
    conflictingPlayers: sameByePlayers.map((s) => s.name),
  };
}
