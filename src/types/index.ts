// ─── Normalized domain types ─────────────────────────────────────────────────

export type Position = "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DST";

export interface NormalizedDraft {
  id: string;
  contestName: string;
  entryFee: number;
  draftedAt: Date;
  startingPick: number;
  totalTeams: number;
  source?: "csv" | "json" | "live";
  players: NormalizedPlayer[];
}

export interface NormalizedPlayer {
  id: string;
  name: string;       // resolved canonical name where possible
  rawName?: string;    // original string from the source, e.g. "J. Jefferson"
  team: string;
  position: Position;
  draftedPick: number;
  draftedRound: number;
  adpAtDraft: number | null;
  currentAdp: number | null;
  draftId: string;
}

// ─── Analytics types ──────────────────────────────────────────────────────────

export interface PlayerExposure {
  name: string;
  team: string;
  position: Position;
  draftCount: number;
  exposure: number;
  avgPickWhenDrafted: number;
  avgAdp: number | null;
  clvAvg: number | null;
}

export interface StackExposure {
  qbName: string;
  partnerName: string;
  partnerPosition: Position;
  count: number;
  exposure: number;
}

export interface PortfolioStats {
  totalDrafts: number;
  totalEntryFees: number;
  avgEntryFee: number;
  uniquePlayers: number;
  dateRange: { earliest: Date; latest: Date } | null;
}

// ─── CSV row types (DK draft history import) ─────────────────────────────────

export interface RawDKRow {
  [key: string]: string;
}

export interface ParsedCSVResult {
  drafts: NormalizedDraft[];
  rawRows: RawDKRow[];
  errors: string[];
}

// ─── Live draft assistant types ──────────────────────────────────────────────

export interface LiveDraftPick {
  playerName: string;     // resolved canonical name
  rawName?: string;        // raw text scraped off the board, e.g. "J. Gibbs"
  team: string;
  position: Position;
  pickNumber: number;
  pickedByMe: boolean;
  pickedAt: string; // ISO
}

export interface LiveDraftState {
  sessionId: string;
  contestName: string | null;
  myUsername: string | null;
  totalTeams: number;
  startingPick: number;
  currentPickNumber: number;
  isOnTheClock: boolean;
  picks: LiveDraftPick[];
  myRoster: LiveDraftPick[];
  updatedAt: string;
}

// One row in the live recommended-players sidebar
export interface RecommendedPlayer {
  name: string;
  team: string;
  position: Position;

  adp: number | null;          // DraftKings ADP (from master rankings; live-board ADP is a future upgrade)
  adpTrend: number | null;     // negative = rising (good), positive = falling

  playoffTotalOU: number | null; // avg of weeks 15+16+17 game O/U (same scale as week17OU)
  week17OU: number | null;
  impliedTeamTotal: number | null; // avg team total across weeks 15-17

  personalExposure: number | null;
  correlationFlag: CorrelationFlag | null;

  positionalValue: number | null; // feature-flagged

  byeWeek: number | null;
  byeConflict: boolean;

  underdogAdp: number | null;
  adpDelta: number | null; // dkAdp - underdogAdp; negative = UD's number is bigger, positive = DK's is bigger
}

export interface CorrelationFlag {
  withPlayer: string;
  jaccardIndex: number;
  yourCoExposure: number;
}

export interface ColorScaleResult {
  value: number;
  tier: "bad" | "below" | "neutral" | "above" | "good";
  colorHex: string;
}
