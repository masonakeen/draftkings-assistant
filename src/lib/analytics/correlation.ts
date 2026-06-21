import type { NormalizedDraft, CorrelationFlag } from "../../types";

/**
 * Pure function — builds a fast lookup index from full draft history.
 * playerDrafts: lowercase player name -> set of draft IDs they appeared in
 * draftPlayers: draft ID -> set of lowercase player names in that draft
 */
export interface CoOccurrenceIndex {
  playerDrafts: Map<string, Set<string>>;
  draftPlayers: Map<string, Set<string>>;
  totalDrafts: number;
}

export function buildCoOccurrenceIndex(drafts: NormalizedDraft[]): CoOccurrenceIndex {
  const playerDrafts = new Map<string, Set<string>>();
  const draftPlayers = new Map<string, Set<string>>();

  for (const draft of drafts) {
    const namesInDraft = new Set<string>();
    for (const p of draft.players) {
      const key = p.name.toLowerCase();
      namesInDraft.add(key);
      if (!playerDrafts.has(key)) playerDrafts.set(key, new Set());
      playerDrafts.get(key)!.add(draft.id);
    }
    draftPlayers.set(draft.id, namesInDraft);
  }

  return { playerDrafts, draftPlayers, totalDrafts: drafts.length };
}

/**
 * For a given player, find the players they're most "tightly coupled" with —
 * i.e. who shows up disproportionately often in the same drafts.
 *
 * jaccardIndex = |A ∩ B| / |A ∪ B|                  (symmetric overlap)
 * yourCoExposure = |A ∩ B| / |A|                    (conditional: of your A-drafts, % that also have B)
 */
export function getTopCorrelations(
  index: CoOccurrenceIndex,
  targetPlayerName: string,
  options: { minSharedDrafts?: number; topN?: number } = {}
): CorrelationFlag[] {
  const { minSharedDrafts = 2, topN = 5 } = options;
  const targetKey = targetPlayerName.toLowerCase();
  const targetDraftIds = index.playerDrafts.get(targetKey);

  if (!targetDraftIds || targetDraftIds.size === 0) return [];

  // Count co-occurrences with every other player across target's drafts
  const coCounts = new Map<string, number>();
  for (const draftId of targetDraftIds) {
    const namesInDraft = index.draftPlayers.get(draftId);
    if (!namesInDraft) continue;
    for (const name of namesInDraft) {
      if (name === targetKey) continue;
      coCounts.set(name, (coCounts.get(name) ?? 0) + 1);
    }
  }

  const flags: CorrelationFlag[] = [];

  for (const [otherName, coCount] of coCounts) {
    if (coCount < minSharedDrafts) continue;

    const otherDraftIds = index.playerDrafts.get(otherName);
    if (!otherDraftIds) continue;

    const unionCount = targetDraftIds.size + otherDraftIds.size - coCount;
    const jaccardIndex = unionCount > 0 ? coCount / unionCount : 0;
    const yourCoExposure = (coCount / targetDraftIds.size) * 100;

    flags.push({
      withPlayer: otherName, // display layer should re-cased this against known player list
      jaccardIndex: Math.round(jaccardIndex * 1000) / 1000,
      yourCoExposure: Math.round(yourCoExposure * 10) / 10,
    });
  }

  return flags
    .sort((a, b) => b.jaccardIndex - a.jaccardIndex)
    .slice(0, topN);
}

/**
 * Live-draft use case: given a candidate available player and the names
 * already on your in-progress roster, return the single strongest coupling
 * flag if it crosses a meaningful threshold — used to warn "you're already
 * overexposed to this combo."
 */
export function checkCorrelationFlag(
  index: CoOccurrenceIndex,
  candidatePlayerName: string,
  currentRosterNames: string[],
  options: { jaccardThreshold?: number; coExposureThreshold?: number; minSharedDrafts?: number } = {}
): CorrelationFlag | null {
  const { jaccardThreshold = 0.2, coExposureThreshold = 50, minSharedDrafts = 2 } = options;

  const candidateKey = candidatePlayerName.toLowerCase();
  const candidateDraftIds = index.playerDrafts.get(candidateKey);
  if (!candidateDraftIds) return null;

  let strongest: CorrelationFlag | null = null;

  for (const rosterName of currentRosterNames) {
    const rosterKey = rosterName.toLowerCase();
    if (rosterKey === candidateKey) continue;

    const rosterDraftIds = index.playerDrafts.get(rosterKey);
    if (!rosterDraftIds) continue;

    let coCount = 0;
    for (const id of candidateDraftIds) {
      if (rosterDraftIds.has(id)) coCount++;
    }
    if (coCount < minSharedDrafts) continue;

    const unionCount = candidateDraftIds.size + rosterDraftIds.size - coCount;
    const jaccardIndex = unionCount > 0 ? coCount / unionCount : 0;
    const yourCoExposure = (coCount / rosterDraftIds.size) * 100;

    if (jaccardIndex >= jaccardThreshold || yourCoExposure >= coExposureThreshold) {
      if (!strongest || jaccardIndex > strongest.jaccardIndex) {
        strongest = {
          withPlayer: rosterName,
          jaccardIndex: Math.round(jaccardIndex * 1000) / 1000,
          yourCoExposure: Math.round(yourCoExposure * 10) / 10,
        };
      }
    }
  }

  return strongest;
}
