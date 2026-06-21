import { randomUUID } from "node:crypto";
import type { LiveDraftPick, LiveDraftState } from "../../types";

/**
 * Holds the single in-progress draft session in memory. The bridge feeds it
 * whole-board snapshots (the grid is small enough — ~240 cells max — that
 * resending the full picture each time is simpler and more robust than
 * incremental diffing against a virtualized DOM).
 */
class DraftSessionManager {
  private state: LiveDraftState;
  private rosterSize = 20; // updated from the first snapshot's column height
  private listeners: Set<(state: LiveDraftState) => void> = new Set();

  constructor() {
    this.state = this.emptyState();
  }

  private emptyState(): LiveDraftState {
    return {
      sessionId: randomUUID(),
      contestName: null,
      myUsername: null,
      totalTeams: 12,
      startingPick: 1,
      currentPickNumber: 1,
      isOnTheClock: false,
      picks: [],
      myRoster: [],
      updatedAt: new Date().toISOString(),
    };
  }

  getState(): LiveDraftState {
    return this.state;
  }

  /**
   * Applies a full re-scan of the board. Picks are resolved (canonical
   * names) by the caller before reaching here — this class just does state
   * bookkeeping. If the incoming pick count is LOWER than what we already
   * have, that can only mean a new draft started, so we reset first.
   */
  applySnapshot(opts: {
    contestName: string | null;
    totalTeams: number;
    myUsername: string | null;
    rosterSize?: number;
    picks: LiveDraftPick[];
  }) {
    const isNewDraft = opts.picks.length < this.state.picks.length;
    if (isNewDraft) {
      this.state = this.emptyState();
    }

    if (opts.rosterSize) this.rosterSize = opts.rosterSize;

    const sortedPicks = [...opts.picks].sort((a, b) => a.pickNumber - b.pickNumber);
    const myRoster = sortedPicks.filter((p) => p.pickedByMe);

    this.state = {
      ...this.state,
      contestName: opts.contestName ?? this.state.contestName,
      myUsername: opts.myUsername ?? this.state.myUsername,
      totalTeams: opts.totalTeams || this.state.totalTeams,
      picks: sortedPicks,
      myRoster,
      currentPickNumber: sortedPicks.length + 1,
      updatedAt: new Date().toISOString(),
    };
    this.emit();
  }

  setOnTheClock(isOnTheClock: boolean) {
    this.state = { ...this.state, isOnTheClock, updatedAt: new Date().toISOString() };
    this.emit();
  }

  getDraftedPlayerNames(): Set<string> {
    return new Set(this.state.picks.map((p) => p.playerName.toLowerCase()));
  }

  getMyRosterNames(): string[] {
    return this.state.myRoster.map((p) => p.playerName);
  }

  isComplete(): boolean {
    const totalPicks = this.state.totalTeams * this.rosterSize;
    return totalPicks > 0 && this.state.picks.length >= totalPicks;
  }

  reset() {
    this.state = this.emptyState();
    this.emit();
  }

  subscribe(listener: (state: LiveDraftState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener(this.state);
  }
}

// Singleton — one live draft at a time, which matches how you'd actually use this.
export const draftSession = new DraftSessionManager();
